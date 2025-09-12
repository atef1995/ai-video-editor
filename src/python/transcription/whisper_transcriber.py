import whisper
import json
import sys
import argparse
from pathlib import Path

class WhisperTranscriber:
    def __init__(self, model_size="base"):
        """
        Initialize Whisper transcriber
        Args:
            model_size (str): Size of Whisper model ('tiny', 'base', 'small', 'medium', 'large')
        """
        self.model = whisper.load_model(model_size)
    
    def transcribe(self, audio_path, language=None):
        """
        Transcribe audio file using Whisper
        Args:
            audio_path (str): Path to audio file
            language (str): Language code (optional, auto-detect if None)
        Returns:
            dict: Transcription results with timestamps
        """
        try:
            result = self.model.transcribe(
                audio_path,
                language=language,
                word_timestamps=True,
                verbose=False
            )
            
            # Format results for easier processing
            formatted_result = {
                'text': result['text'],
                'language': result['language'],
                'segments': []
            }
            
            for segment in result['segments']:
                formatted_segment = {
                    'id': segment['id'],
                    'start': segment['start'],
                    'end': segment['end'],
                    'text': segment['text'].strip(),
                    'confidence': segment.get('avg_logprob', 0.0),
                    'words': []
                }
                
                if 'words' in segment:
                    for word in segment['words']:
                        formatted_segment['words'].append({
                            'word': word['word'],
                            'start': word['start'],
                            'end': word['end'],
                            'probability': word.get('probability', 1.0)
                        })
                
                formatted_result['segments'].append(formatted_segment)
            
            return formatted_result
            
        except Exception as e:
            return {
                'error': str(e),
                'text': '',
                'language': 'unknown',
                'segments': []
            }
    
    def transcribe_to_file(self, audio_path, output_path, language=None):
        """
        Transcribe audio and save results to JSON file
        """
        result = self.transcribe(audio_path, language)
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(result, f, indent=2, ensure_ascii=False)
        
        return result

def main():
    parser = argparse.ArgumentParser(description='Transcribe audio using Whisper')
    parser.add_argument('input_path', help='Path to audio/video file')
    parser.add_argument('output_path', help='Path to output JSON file')
    parser.add_argument('--model', default='base', help='Whisper model size')
    parser.add_argument('--language', help='Language code (optional)')
    
    args = parser.parse_args()
    
    transcriber = WhisperTranscriber(args.model)
    result = transcriber.transcribe_to_file(
        args.input_path, 
        args.output_path, 
        args.language
    )
    
    if 'error' in result:
        print(f"Error: {result['error']}", file=sys.stderr)
        sys.exit(1)
    else:
        print(f"Transcription completed. Language: {result['language']}")
        print(f"Total segments: {len(result['segments'])}")

if __name__ == "__main__":
    main()