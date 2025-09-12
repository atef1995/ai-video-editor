import openai
import json
import sys
import argparse
from sentence_transformers import SentenceTransformer
import numpy as np
from typing import List, Dict, Any

class ContentAnalyzer:
    def __init__(self, openai_api_key=None):
        """
        Initialize content analyzer with AI models
        Args:
            openai_api_key (str): OpenAI API key for GPT analysis
        """
        if openai_api_key:
            openai.api_key = openai_api_key
        
        # Load sentence transformer for semantic similarity
        try:
            self.sentence_model = SentenceTransformer('all-MiniLM-L6-v2')
        except:
            self.sentence_model = None
            print("Warning: Could not load sentence transformer model")
    
    def analyze_transcript_with_gpt(self, transcript_data: Dict) -> Dict:
        """
        Analyze transcript content using GPT-4 to identify key moments and topics
        """
        if not openai.api_key:
            return {"error": "OpenAI API key not provided"}
        
        # Combine all segments into full text
        full_text = transcript_data.get('text', '')
        segments = transcript_data.get('segments', [])
        
        # Create prompt for GPT analysis
        prompt = f"""
        Analyze this video transcript for creating engaging short clips. Please identify:
        
        1. Key topics and themes discussed
        2. Most engaging moments with high energy or important information
        3. Natural clip boundaries (complete thoughts/topics)
        4. Emotional peaks (excitement, surprise, revelation)
        5. Actionable insights or valuable takeaways
        
        Transcript:
        {full_text[:4000]}  # Limit to avoid token limits
        
        Please respond in JSON format with:
        {{
            "topics": ["topic1", "topic2", ...],
            "key_moments": [
                {{
                    "start_time": float,
                    "end_time": float,
                    "description": "why this moment is engaging",
                    "engagement_score": int (1-100),
                    "emotional_tone": "string",
                    "contains_action_items": boolean
                }}
            ],
            "overall_sentiment": "string",
            "content_type": "educational/entertainment/interview/etc"
        }}
        """
        
        try:
            response = openai.ChatCompletion.create(
                model="gpt-4",
                messages=[
                    {"role": "system", "content": "You are an expert video content analyzer specializing in identifying engaging moments for short-form content."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=2000,
                temperature=0.3
            )
            
            # Parse JSON response
            analysis_text = response.choices[0].message.content
            return json.loads(analysis_text)
            
        except Exception as e:
            return {"error": f"GPT analysis failed: {str(e)}"}
    
    def find_topic_segments(self, transcript_data: Dict, similarity_threshold=0.7) -> List[Dict]:
        """
        Use sentence transformers to find semantically similar segments
        """
        if not self.sentence_model:
            return []
        
        segments = transcript_data.get('segments', [])
        if len(segments) < 2:
            return segments
        
        # Get embeddings for each segment
        segment_texts = [seg['text'] for seg in segments]
        embeddings = self.sentence_model.encode(segment_texts)
        
        # Group similar segments
        topic_segments = []
        used_indices = set()
        
        for i, embedding in enumerate(embeddings):
            if i in used_indices:
                continue
                
            # Find similar segments
            similarities = np.dot(embeddings, embedding) / (
                np.linalg.norm(embeddings, axis=1) * np.linalg.norm(embedding)
            )
            
            similar_indices = [
                j for j, sim in enumerate(similarities) 
                if sim > similarity_threshold and j not in used_indices
            ]
            
            if similar_indices:
                # Create topic segment
                start_time = min(segments[j]['start'] for j in similar_indices)
                end_time = max(segments[j]['end'] for j in similar_indices)
                combined_text = ' '.join(segments[j]['text'] for j in similar_indices)
                
                topic_segments.append({
                    'start_time': start_time,
                    'end_time': end_time,
                    'text': combined_text,
                    'segment_count': len(similar_indices),
                    'avg_similarity': np.mean([similarities[j] for j in similar_indices])
                })
                
                used_indices.update(similar_indices)
        
        return topic_segments
    
    def score_engagement(self, text: str, duration: float) -> Dict:
        """
        Score engagement potential of a text segment
        """
        engagement_indicators = {
            'questions': ['?', 'what', 'how', 'why', 'when', 'where'],
            'excitement': ['!', 'amazing', 'incredible', 'wow', 'fantastic'],
            'actionable': ['should', 'must', 'need to', 'important', 'key'],
            'emotional': ['love', 'hate', 'fear', 'excited', 'surprised'],
            'numbers': ['first', 'second', 'three', 'million', 'percent']
        }
        
        text_lower = text.lower()
        scores = {}
        
        for category, indicators in engagement_indicators.items():
            score = sum(1 for indicator in indicators if indicator in text_lower)
            scores[category] = score
        
        # Calculate overall engagement score
        total_score = sum(scores.values())
        
        # Adjust for duration (shorter clips often more engaging)
        duration_factor = max(0.5, min(1.0, 30 / max(duration, 1)))
        
        engagement_score = min(100, int(total_score * 10 * duration_factor))
        
        return {
            'engagement_score': engagement_score,
            'category_scores': scores,
            'duration_factor': duration_factor
        }
    
    def analyze_full_content(self, transcript_data: Dict) -> Dict:
        """
        Perform comprehensive content analysis
        """
        results = {
            'timestamp': transcript_data.get('timestamp'),
            'language': transcript_data.get('language'),
            'total_duration': 0
        }
        
        # Calculate total duration
        segments = transcript_data.get('segments', [])
        if segments:
            results['total_duration'] = segments[-1]['end']
        
        # GPT-4 analysis
        gpt_analysis = self.analyze_transcript_with_gpt(transcript_data)
        results['gpt_analysis'] = gpt_analysis
        
        # Topic segmentation
        topic_segments = self.find_topic_segments(transcript_data)
        results['topic_segments'] = topic_segments
        
        # Engagement scoring for each segment
        segment_scores = []
        for segment in segments:
            duration = segment['end'] - segment['start']
            engagement = self.score_engagement(segment['text'], duration)
            
            segment_scores.append({
                'start': segment['start'],
                'end': segment['end'],
                'text': segment['text'],
                'duration': duration,
                **engagement
            })
        
        results['segment_scores'] = segment_scores
        
        # Find top engaging segments
        top_segments = sorted(
            segment_scores, 
            key=lambda x: x['engagement_score'], 
            reverse=True
        )[:10]  # Top 10 most engaging segments
        
        results['top_engaging_segments'] = top_segments
        
        return results

def main():
    parser = argparse.ArgumentParser(description='Analyze video content for AI processing')
    parser.add_argument('transcript_path', help='Path to transcript JSON file')
    parser.add_argument('output_path', help='Path to output analysis JSON file')
    parser.add_argument('--openai-key', help='OpenAI API key')
    
    args = parser.parse_args()
    
    # Load transcript
    with open(args.transcript_path, 'r', encoding='utf-8') as f:
        transcript_data = json.load(f)
    
    # Analyze content
    analyzer = ContentAnalyzer(args.openai_key)
    analysis = analyzer.analyze_full_content(transcript_data)
    
    # Save results
    with open(args.output_path, 'w', encoding='utf-8') as f:
        json.dump(analysis, f, indent=2, ensure_ascii=False)
    
    print(f"Content analysis completed")
    print(f"Found {len(analysis.get('top_engaging_segments', []))} top engaging segments")

if __name__ == "__main__":
    main()