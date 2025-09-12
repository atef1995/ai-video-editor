#!/usr/bin/env python3
"""
AI Video Processing Pipeline Coordinator
This script coordinates the entire AI processing workflow for video analysis and clip generation.
"""

import os
import sys
import json
import argparse
import time
from pathlib import Path
from typing import Dict, List, Any

# Add current directory to path for imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from transcription.whisper_transcriber import WhisperTranscriber
from analysis.content_analyzer import ContentAnalyzer
from editing.video_processor import VideoProcessor

class AIPipeline:
    def __init__(self, temp_dir="temp", openai_api_key=None):
        """
        Initialize AI processing pipeline
        Args:
            temp_dir (str): Directory for temporary files
            openai_api_key (str): OpenAI API key for GPT analysis
        """
        self.temp_dir = Path(temp_dir)
        self.temp_dir.mkdir(exist_ok=True)
        
        # Initialize components
        self.transcriber = WhisperTranscriber("base")  # Use base model for balance of speed/accuracy
        self.analyzer = ContentAnalyzer(openai_api_key)
        self.video_processor = VideoProcessor(temp_dir)
        
        self.progress_callback = None
    
    def set_progress_callback(self, callback):
        """Set callback function for progress updates"""
        self.progress_callback = callback
    
    def update_progress(self, step: str, progress: float):
        """Update processing progress"""
        if self.progress_callback:
            self.progress_callback(step, progress)
        else:
            print(f"[{progress:.1f}%] {step}")
    
    def process_video(self, video_path: str, output_dir: str = None) -> Dict[str, Any]:
        """
        Complete video processing pipeline
        Args:
            video_path (str): Path to input video
            output_dir (str): Directory for output files
        Returns:
            dict: Processing results with generated clips info
        """
        if output_dir is None:
            output_dir = self.temp_dir / "output"
        
        output_dir = Path(output_dir)
        output_dir.mkdir(exist_ok=True)
        
        video_name = Path(video_path).stem
        
        try:
            # Step 1: Extract video info and audio
            self.update_progress("Extracting video metadata and audio", 10)
            
            video_prep = self.video_processor.process_video_for_analysis(video_path)
            if not video_prep['success']:
                raise Exception(f"Video preparation failed: {video_prep['error']}")
            
            # Step 2: Transcribe audio
            self.update_progress("Transcribing audio with Whisper AI", 30)
            
            transcript_path = output_dir / f"{video_name}_transcript.json"
            transcript_result = self.transcriber.transcribe_to_file(
                video_prep['audio_path'], 
                str(transcript_path)
            )
            
            if 'error' in transcript_result:
                raise Exception(f"Transcription failed: {transcript_result['error']}")
            
            # Step 3: Analyze content
            self.update_progress("Analyzing content with AI", 50)
            
            analysis_path = output_dir / f"{video_name}_analysis.json"
            analysis_result = self.analyzer.analyze_full_content(transcript_result)
            
            with open(analysis_path, 'w', encoding='utf-8') as f:
                json.dump(analysis_result, f, indent=2, ensure_ascii=False)
            
            # Step 4: Generate clips based on analysis
            self.update_progress("Generating short clips", 70)
            
            clips = self.generate_clips_from_analysis(
                video_path, 
                analysis_result, 
                output_dir,
                max_clips=5
            )
            
            # Step 5: Post-process and finalize
            self.update_progress("Finalizing clips and metadata", 90)
            
            # Generate final results
            results = {
                'success': True,
                'video_info': video_prep['video_info'],
                'transcript_path': str(transcript_path),
                'analysis_path': str(analysis_path),
                'thumbnail_path': video_prep['thumbnail_path'],
                'clips': clips,
                'processing_time': time.time(),
                'total_clips_generated': len(clips)
            }
            
            # Save results summary
            results_path = output_dir / f"{video_name}_results.json"
            with open(results_path, 'w', encoding='utf-8') as f:
                json.dump(results, f, indent=2, ensure_ascii=False)
            
            self.update_progress("Processing completed successfully", 100)
            
            return results
            
        except Exception as e:
            error_result = {
                'success': False,
                'error': str(e),
                'video_path': video_path,
                'timestamp': time.time()
            }
            
            self.update_progress(f"Processing failed: {str(e)}", 0)
            return error_result
    
    def generate_clips_from_analysis(self, video_path: str, analysis: Dict, 
                                   output_dir: Path, max_clips: int = 5) -> List[Dict]:
        """
        Generate video clips based on content analysis
        """
        clips = []
        
        # Get top engaging segments
        top_segments = analysis.get('top_engaging_segments', [])
        gpt_moments = analysis.get('gpt_analysis', {}).get('key_moments', [])
        
        # Combine and sort by engagement score
        all_candidates = []
        
        # Add top scoring segments
        for segment in top_segments[:max_clips * 2]:  # Get more candidates
            all_candidates.append({
                'start_time': segment['start'],
                'end_time': segment['end'],
                'text': segment['text'],
                'score': segment['engagement_score'],
                'source': 'segment_analysis'
            })
        
        # Add GPT-identified moments
        for moment in gpt_moments:
            all_candidates.append({
                'start_time': moment.get('start_time', 0),
                'end_time': moment.get('end_time', 30),
                'text': moment.get('description', ''),
                'score': moment.get('engagement_score', 50),
                'source': 'gpt_analysis'
            })
        
        # Remove duplicates and sort by score
        unique_candidates = []
        for candidate in all_candidates:
            # Check for overlap with existing candidates
            overlaps = False
            for existing in unique_candidates:
                if (abs(candidate['start_time'] - existing['start_time']) < 5):  # 5 second tolerance
                    overlaps = True
                    break
            
            if not overlaps:
                unique_candidates.append(candidate)
        
        # Sort by score and take top clips
        unique_candidates.sort(key=lambda x: x['score'], reverse=True)
        selected_candidates = unique_candidates[:max_clips]
        
        # Generate actual video clips
        video_name = Path(video_path).stem
        
        for i, candidate in enumerate(selected_candidates):
            try:
                # Ensure minimum duration of 15 seconds for shorts
                duration = candidate['end_time'] - candidate['start_time']
                if duration < 15:
                    # Extend the clip to 15 seconds, centered on the original segment
                    center = (candidate['start_time'] + candidate['end_time']) / 2
                    candidate['start_time'] = max(0, center - 7.5)
                    candidate['end_time'] = candidate['start_time'] + 15
                
                # Limit to maximum 60 seconds
                if duration > 60:
                    candidate['end_time'] = candidate['start_time'] + 60
                
                clip_filename = f"{video_name}_clip_{i+1}_{int(candidate['start_time'])}.mp4"
                clip_path = output_dir / clip_filename
                
                # Create the clip
                created_clip_path = self.video_processor.create_clip(
                    video_path,
                    candidate['start_time'],
                    candidate['end_time'],
                    str(clip_path),
                    target_aspect='9:16'  # Vertical format for shorts
                )
                
                # Generate thumbnail for the clip
                thumbnail_path = self.video_processor.generate_thumbnail(
                    created_clip_path,
                    time_point=5,  # 5 seconds into the clip
                    output_path=str(output_dir / f"{video_name}_clip_{i+1}_thumb.jpg")
                )
                
                clip_info = {
                    'id': i + 1,
                    'file_path': created_clip_path,
                    'thumbnail_path': thumbnail_path,
                    'start_time': candidate['start_time'],
                    'end_time': candidate['end_time'],
                    'duration': candidate['end_time'] - candidate['start_time'],
                    'description': candidate['text'][:200] + '...' if len(candidate['text']) > 200 else candidate['text'],
                    'engagement_score': candidate['score'],
                    'source_analysis': candidate['source'],
                    'aspect_ratio': '9:16',
                    'topics': [],  # Could be extracted from analysis
                    'created_at': time.time()
                }
                
                clips.append(clip_info)
                
            except Exception as e:
                print(f"Failed to create clip {i+1}: {e}")
                continue
        
        return clips

def main():
    parser = argparse.ArgumentParser(description='AI Video Processing Pipeline')
    parser.add_argument('video_path', help='Path to input video file')
    parser.add_argument('--output-dir', help='Output directory for processed files')
    parser.add_argument('--openai-key', help='OpenAI API key for advanced analysis')
    parser.add_argument('--max-clips', type=int, default=5, help='Maximum clips to generate')
    parser.add_argument('--temp-dir', default='temp', help='Temporary directory')
    
    args = parser.parse_args()
    
    # Initialize pipeline
    pipeline = AIPipeline(
        temp_dir=args.temp_dir,
        openai_api_key=args.openai_key
    )
    
    # Process video
    print(f"Starting AI processing for: {args.video_path}")
    
    results = pipeline.process_video(
        video_path=args.video_path,
        output_dir=args.output_dir
    )
    
    # Output results
    if results['success']:
        print(f"\\nProcessing completed successfully!")
        print(f"Generated {results['total_clips_generated']} clips")
        print(f"Results saved to: {args.output_dir}")
        
        for i, clip in enumerate(results['clips'], 1):
            print(f"  Clip {i}: {clip['duration']:.1f}s (score: {clip['engagement_score']})")
            
    else:
        print(f"\\nProcessing failed: {results['error']}")
        sys.exit(1)

if __name__ == "__main__":
    main()