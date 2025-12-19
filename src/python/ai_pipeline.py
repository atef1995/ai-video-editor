#!/usr/bin/env python3
"""
AI Video Processing Pipeline Coordinator
This script coordinates the entire AI processing workflow for video analysis and clip generation.
Enhanced workflow: Cut quiet parts -> Transcribe -> Analyze -> Generate clips
"""

from editing.video_processor import VideoProcessor
from analysis.content_analyzer import ContentAnalyzer
from transcription.whisper_transcriber import WhisperTranscriber
import os
import sys
import json
import argparse
import time
import subprocess
from pathlib import Path
from typing import Dict, List, Any

# Add current directory to path for imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))


class AIPipeline:
    def __init__(self, temp_dir="temp", openai_api_key=None, clip_settings=None):
        """
        Initialize AI processing pipeline
        Args:
            temp_dir (str): Directory for temporary files
            openai_api_key (str): OpenAI API key for GPT analysis
            clip_settings (dict): Settings for clip generation
        """
        self.temp_dir = Path(temp_dir)
        self.temp_dir.mkdir(exist_ok=True)

        # Store clip settings with defaults
        self.clip_settings = clip_settings or {
            'min_duration': 30,
            'max_duration': 90,
            'max_clips': 5,
            'focus_on_high_energy': True,
            'include_actionable_content': True,
            'include_emotional_peaks': True,
            'include_insights': True
        }

        # Initialize components
        # Use base model for balance of speed/accuracy
        self.transcriber = WhisperTranscriber("base")
        self.analyzer = ContentAnalyzer(openai_api_key)
        self.video_processor = VideoProcessor(temp_dir)

        # Path to jumpcutter script
        self.jumpcutter_script = Path(
            __file__).parent / "cut-quiet-parts" / "jumpcutter.py"

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

        # Always flush to ensure output is written immediately
        sys.stdout.flush()

    def cut_quiet_parts(self, video_path: str) -> str:
        """
        Remove quiet parts from video using jumpcutter
        Args:
            video_path (str): Path to input video
        Returns:
            str: Path to processed video with quiet parts removed
        """
        video_name = Path(video_path).stem
        output_path = self.temp_dir / f"{video_name}_no_quiet.mp4"

        self.update_progress("Removing quiet parts from video", 15)

        try:
            # Run jumpcutter script
            cmd = [
                "python", str(self.jumpcutter_script),
                "--input_file", video_path,
                "--output_file", str(output_path),
                "--silent_threshold", "0.03",
                "--silent_speed", "999999",  # Cut out completely
                "--sounded_speed", "1.0",
                "--frame_margin", "2"  # Keep some context frames
            ]

            process = subprocess.run(
                cmd, capture_output=True, text=True, cwd=self.jumpcutter_script.parent)

            if process.returncode != 0:
                print(f"Jumpcutter stdout: {process.stdout}")
                print(f"Jumpcutter stderr: {process.stderr}")
                raise Exception(
                    f"Jumpcutter failed with return code {process.returncode}")

            if not output_path.exists():
                raise Exception("Jumpcutter did not produce output file")

            print(f"Quiet parts removed successfully: {output_path}")
            return str(output_path)

        except Exception as e:
            print(f"Failed to cut quiet parts: {str(e)}")
            # If jumpcutter fails, return original video path
            print("Falling back to original video")
            return video_path

    def process_video(self, video_path: str, output_dir: str = None) -> Dict[str, Any]:
        """
        Complete video processing pipeline with enhanced workflow:
        1. Cut quiet parts first
        2. Transcribe the processed video
        3. Analyze content with GPT
        4. Generate clips
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
            print(f"Starting enhanced video processing for: {video_path}")
            print(f"Output directory: {output_dir}")

            # Step 1: Cut quiet parts from video
            processed_video_path = self.cut_quiet_parts(video_path)

            # Step 2: Extract video info and audio from processed video
            self.update_progress(
                "Extracting metadata from processed video", 25)

            video_prep = self.video_processor.process_video_for_analysis(
                processed_video_path)
            if not video_prep['success']:
                raise Exception(
                    f"Video preparation failed: {video_prep['error']}")

            # Step 3: Transcribe audio from processed video
            self.update_progress(
                "Transcribing processed audio with Whisper AI", 40)

            transcript_path = output_dir / f"{video_name}_transcript.json"
            transcript_result = self.transcriber.transcribe_to_file(
                video_prep['audio_path'],
                str(transcript_path)
            )

            if 'error' in transcript_result:
                raise Exception(
                    f"Transcription failed: {transcript_result['error']}")

            # Step 4: Analyze content with GPT
            self.update_progress("Analyzing content with AI", 55)

            analysis_path = output_dir / f"{video_name}_analysis.json"
            analysis_result = self.analyzer.analyze_content(
                transcript_result, self.clip_settings)

            # Check for analysis errors
            if analysis_result.get('error'):
                print(f"Analysis error details: {analysis_result['error']}")
                raise Exception(
                    f"Content analysis failed: {analysis_result['error']}")

            print(f"Analysis result: {json.dumps(analysis_result, indent=2)}")

            with open(analysis_path, 'w', encoding='utf-8') as f:
                json.dump(analysis_result, f, indent=2, ensure_ascii=False)

            # Step 5: Generate clips based on analysis (use processed video for clips)
            self.update_progress(
                "Generating short clips from processed video", 75)

            clips = self.generate_clips_from_analysis(
                processed_video_path,  # Use processed video for consistent timestamps
                analysis_result,
                output_dir,
                max_clips=self.clip_settings['max_clips']
            )

            # Step 6: Post-process and finalize
            self.update_progress("Finalizing clips and metadata", 90)

            # Generate final results
            results = {
                'success': True,
                'original_video_path': video_path,
                'video_info': video_prep['video_info'],
                'processed_video_path': processed_video_path,
                'transcript_path': str(transcript_path),
                'analysis_path': str(analysis_path),
                'thumbnail_path': video_prep['thumbnail_path'],
                'clips': clips,
                'processing_time': time.time(),
                'total_clips_generated': len(clips),
                'note': 'Clips generated from processed video (quiet parts removed) for better timestamp accuracy'
            }

            # Save results summary
            results_path = output_dir / f"{video_name}_results.json"
            with open(results_path, 'w', encoding='utf-8') as f:
                json.dump(results, f, indent=2, ensure_ascii=False)

            self.update_progress("Processing completed successfully", 100)

            return results

        except Exception as e:
            print(f"Exception occurred: {str(e)}")
            print(f"Exception type: {type(e).__name__}")
            import traceback
            traceback.print_exc()

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
        Generate video clips based on GPT analysis only
        """
        clips = []

        # Get GPT-recommended clips
        gpt_clips = analysis.get('clips', [])

        if not gpt_clips:
            print("No clips found in GPT analysis")
            return clips

        # Use GPT clips directly, limit to max_clips
        selected_candidates = gpt_clips[:max_clips]

        # Generate actual video clips
        video_name = Path(video_path).stem

        for i, candidate in enumerate(selected_candidates):
            try:
                start_time = candidate['start_time']
                end_time = candidate['end_time']
                description = candidate.get('description', 'AI-selected clip')

                # Validate timestamps
                duration = end_time - start_time
                min_duration = self.clip_settings.get('min_duration', 30)
                max_duration = self.clip_settings.get('max_duration', 90)

                # Only enforce minimum duration if it's greater than 5 seconds
                # This allows shorter clips if they're naturally that length
                absolute_minimum = 5
                if duration < absolute_minimum:  # Too short to be useful
                    print(
                        f"Skipping clip {i+1}: duration too short ({duration:.1f}s, absolute minimum: {absolute_minimum}s)")
                    continue

                # If clip is shorter than user's preferred minimum but longer than absolute minimum,
                # extend it slightly or keep it as is if it's a natural segment boundary
                if duration < min_duration:
                    print(
                        f"Clip {i+1} is {duration:.1f}s (shorter than preferred {min_duration}s) but keeping as natural segment")

                if duration > max_duration:  # Too long, trim to max duration
                    end_time = start_time + max_duration
                    print(
                        f"Trimming clip {i+1} from {duration:.1f}s to {max_duration}s")

                clip_filename = f"{video_name}_clip_{i+1}_{int(start_time)}.mp4"
                clip_path = output_dir / clip_filename

                # Create the clip
                created_clip_path = self.video_processor.create_clip(
                    video_path,
                    start_time,
                    end_time,
                    str(clip_path),
                    target_aspect='9:16'  # Vertical format for shorts
                )

                # Generate thumbnail for the clip
                thumbnail_path = self.video_processor.generate_thumbnail(
                    created_clip_path,
                    # Middle or 5 seconds into the clip
                    time_point=min(5, duration/2),
                    output_path=str(
                        output_dir / f"{video_name}_clip_{i+1}_thumb.jpg")
                )

                clip_info = {
                    'id': i + 1,
                    'file_path': created_clip_path,
                    'thumbnail_path': thumbnail_path,
                    'start_time': start_time,
                    'end_time': end_time,
                    'duration': end_time - start_time,
                    'description': description[:200] + '...' if len(description) > 200 else description,
                    'source_analysis': 'gpt_clips',
                    'aspect_ratio': '9:16',
                    'created_at': time.time()
                }

                clips.append(clip_info)

            except Exception as e:
                print(f"Failed to create clip {i+1}: {e}")
                continue

        return clips


def main():
    parser = argparse.ArgumentParser(
        description='AI Video Processing Pipeline')
    parser.add_argument('video_path', help='Path to input video file')
    parser.add_argument(
        '--output-dir', help='Output directory for processed files')
    parser.add_argument(
        '--openai-key', help='OpenAI API key for advanced analysis')
    parser.add_argument('--max-clips', type=int, default=5,
                        help='Maximum clips to generate')
    parser.add_argument('--min-duration', type=int, default=30,
                        help='Minimum clip duration in seconds')
    parser.add_argument('--max-duration', type=int, default=90,
                        help='Maximum clip duration in seconds')
    parser.add_argument('--temp-dir', default='temp',
                        help='Temporary directory')
    parser.add_argument('--focus-high-energy', action='store_true',
                        help='Focus on high energy moments')
    parser.add_argument('--include-actionable', action='store_true',
                        help='Include actionable content')
    parser.add_argument('--include-emotional', action='store_true',
                        help='Include emotional peaks')
    parser.add_argument('--include-insights', action='store_true',
                        help='Include valuable insights')

    args = parser.parse_args()

    # Build clip settings from arguments
    clip_settings = {
        'min_duration': args.min_duration,
        'max_duration': args.max_duration,
        'max_clips': args.max_clips,
        'focus_on_high_energy': args.focus_high_energy,
        'include_actionable_content': args.include_actionable,
        'include_emotional_peaks': args.include_emotional,
        'include_insights': args.include_insights
    }

    # Initialize pipeline
    pipeline = AIPipeline(
        temp_dir=args.temp_dir,
        openai_api_key=args.openai_key,
        clip_settings=clip_settings
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
            print(f"  Clip {i}: {clip['duration']:.1f}s")

    else:
        print(f"\\nProcessing failed: {results['error']}")
        sys.exit(1)


if __name__ == "__main__":
    main()
