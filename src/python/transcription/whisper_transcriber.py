import whisper
import json
import sys
import argparse
from pathlib import Path

# Handle both relative and absolute imports
try:
    from .overlay_subtitles import OverlaySubtitles
except ImportError:
    # Fallback for when script is run directly
    try:
        from overlay_subtitles import OverlaySubtitles
    except ImportError:
        # If overlay_subtitles is not available, we'll handle it gracefully
        OverlaySubtitles = None


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

    def transcribe_to_srt_file(self, audio_path, output_path, language=None):
        """
        Transcribe audio and save results to srt file
        """
        result = self.transcribe(audio_path, language)
        srt_file = "subtitles.srt"

        with open(srt_file, "w", encoding='utf-8') as f:
            # Fixed: use result['segments']
            for i, segment in enumerate(result['segments']):
                start = segment['start']  # Fixed: use dict access
                end = segment['end']      # Fixed: use dict access
                text = segment['text']    # Fixed: use dict access

                # Format time properly for SRT
                start_time = self.format_srt_time(start)
                end_time = self.format_srt_time(end)

                f.write(f"{i+1}\n{start_time} --> {end_time}\n{text}\n\n")

        return result

    def format_srt_time(self, seconds):
        """Format seconds to SRT time format (HH:MM:SS,mmm)"""
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        milliseconds = int((seconds % 1) * 1000)

        return f"{hours:02d}:{minutes:02d}:{secs:02d},{milliseconds:03d}"

    def create_srt_from_result(self, transcription_result, srt_file_path):
        """
        Create SRT file from existing transcription result (no re-transcribing)
        Args:
            transcription_result: Result from transcribe() method
            srt_file_path: Path where to save the SRT file
        """
        with open(srt_file_path, "w", encoding='utf-8') as f:
            for i, segment in enumerate(transcription_result['segments']):
                start = segment['start']
                end = segment['end']
                text = segment['text']

                # Format time properly for SRT
                start_time = self.format_srt_time(start)
                end_time = self.format_srt_time(end)

                f.write(f"{i+1}\n{start_time} --> {end_time}\n{text}\n\n")

        print(f"SRT file created: {srt_file_path}")


def main():
    parser = argparse.ArgumentParser(
        description='Transcribe audio using Whisper')
    parser.add_argument('input_path', help='Path to audio/video file')
    parser.add_argument('output_path', help='Path to output JSON file')
    parser.add_argument('--model', default='base', help='Whisper model size')
    parser.add_argument('--language', help='Language code (optional)')
    parser.add_argument('--add-overlay', action='store_true',
                        help='Add subtitle overlay to video')
    parser.add_argument(
        '--video-output', help='Output path for video with subtitles')

    args = parser.parse_args()

    transcriber = WhisperTranscriber(args.model)

    # Always create the JSON transcription file
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

        # Add overlay functionality here
        if args.add_overlay:
            if OverlaySubtitles is None:
                print("Error: overlay_subtitles module not available",
                      file=sys.stderr)
                sys.exit(1)

            print("Creating subtitle overlay...")

            # Create SRT file from existing transcription result (no re-transcribing!)
            srt_file_path = "subtitles.srt"
            transcriber.create_srt_from_result(result, srt_file_path)

            # Apply overlay to video
            overlay_handler = OverlaySubtitles()
            video_output = args.video_output or f"{Path(args.input_path).stem}_with_subtitles.mp4"

            try:
                final_video = overlay_handler.add_subtitles(
                    video_path=args.input_path,
                    srt_file=srt_file_path,
                    output_path=video_output
                )
                print(f"Video with subtitles created: {final_video}")
            except Exception as e:
                print(f"Failed to add subtitle overlay: {e}", file=sys.stderr)
                sys.exit(1)


if __name__ == "__main__":
    main()
