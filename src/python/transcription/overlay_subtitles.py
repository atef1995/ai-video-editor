import subprocess
import os
import sys
import json
import argparse
from pathlib import Path


class OverlaySubtitles:
    def __init__(
            self, video_path: str = None,
            subtitle_file_path: str = None,
            style: dict = None,
            video_info: dict = None
    ):
        self.video_path = video_path
        self.subtitle_file_path = subtitle_file_path
        self.style = style or {}
        self.video_info = video_info or {}

    def add_subtitles(self, output_path: str = None):
        """
        Add subtitles to video using FFmpeg
        Args:
            output_path: Path for output video with subtitles
        Returns:
            str: Path to output video file
        """
        # Use provided paths or fallback to instance variables
        video_input = self.video_path
        subtitle_file = self.subtitle_file_path

        if not video_input or not subtitle_file:
            raise ValueError(
                "Both video_path and subtitle_file_path must be provided")

        # Generate output path if not provided
        if not output_path:
            video_name = Path(video_input).stem
            output_path = str(Path(video_input).parent /
                              f"{video_name}_with_subtitles.mp4")

        try:
            # Cross-platform FFmpeg subtitle handling
            import platform

            if platform.system() == 'Windows':
                # Windows: Convert backslashes and escape colons
                escaped_subtitle = subtitle_file.replace(
                    '\\', '/').replace(':', '\\:')
            else:
                # Linux/Mac: Escape special characters for shell
                escaped_subtitle = subtitle_file.replace("'", "'\"'\"'")

            # Create FFmpeg subtitle filter
            subtitle_filename = Path(subtitle_file).name

            if subtitle_file.endswith('.ass'):
                # For ASS files, use ass filter with absolute path
                vf_filter = f"ass={subtitle_file}"
            else:
                # For SRT files, use subtitles filter with styling
                # Apply basic styling that works reliably
                style_options = []

                if self.style and self.video_info:
                    # Calculate appropriate font size based on video height
                    base_font_size = max(
                        24, int(self.video_info.get('height', 1080) / 30))
                    style_options.append(
                        f"force_style='FontSize={base_font_size}'")
                    style_options.append(
                        "force_style='PrimaryColour=&H00FFFFFF'")  # White text
                    style_options.append(
                        "force_style='OutlineColour=&H00000000'")  # Black outline
                    style_options.append(
                        "force_style='Outline=2'")  # Outline width
                    style_options.append(
                        "force_style='Alignment=2'")  # Bottom center

                if style_options:
                    vf_filter = f"subtitles={subtitle_filename}:{':'.join(style_options)}"
                else:
                    vf_filter = f"subtitles={subtitle_filename}"

            # Use FFmpeg to burn subtitles into video
            cmd = [
                "ffmpeg",
                "-i", video_input,
                "-vf", vf_filter,
                "-c:a", "copy",  # Copy audio without re-encoding
                "-y",  # Overwrite output file
                output_path
            ]

            # Set working directory to subtitle file location for relative path handling
            # For ASS files, use current directory since we use absolute paths
            if subtitle_file.endswith('.ass'):
                working_dir = os.getcwd()
            else:
                working_dir = str(Path(subtitle_file).parent)

            print(
                f"[INFO] FFmpeg command: ffmpeg -i [video] -vf {vf_filter} -c:a copy -y [output]")
            print(f"[INFO] Working directory: {working_dir}")
            print(
                f"[INFO] Subtitle file exists: {Path(subtitle_file).exists()}")

            result = subprocess.run(cmd,
                                    capture_output=True,
                                    text=True,
                                    check=True,
                                    cwd=working_dir)

            # Only show FFmpeg output if there are errors
            if result.stderr:
                # Filter out progress info and only show relevant messages
                stderr_lines = result.stderr.split('\n')
                important_lines = [line for line in stderr_lines
                                   if ('error' in line.lower() or 'warning' in line.lower() or
                                       'libass' in line.lower() or 'subtitle' in line.lower())
                                   and 'frame=' not in line]
                if important_lines:
                    # Show first 3 important lines
                    print(
                        f"[INFO] FFmpeg messages: {'; '.join(important_lines[:3])}")

            print(f"Subtitles added successfully: {output_path}")
            return output_path

        except subprocess.CalledProcessError as e:
            print(f"FFmpeg error: {e.stderr}")
            raise Exception(f"Failed to add subtitles: {e.stderr}")
        except Exception as e:
            print(f"Error adding subtitles: {e}")
            raise

    def _get_aspect_ratio_settings(self):
        """Get subtitle styling based on video aspect ratio and user preferences"""
        video_info = self.video_info
        style = self.style

        # Default settings
        settings = {
            'fontSize': 24,
            'alignment': 2,  # Bottom center
            'marginV': 30,
            'color': '&H00FFFFFF',  # White
            'outlineColor': '&H00000000',  # Black outline
            'outline': 2
        }

        # Adjust based on video aspect ratio
        if video_info.get('isVertical'):
            settings['fontSize'] = 32
            settings['marginV'] = 50
        elif video_info.get('isWidescreen'):
            settings['fontSize'] = 28
            settings['marginV'] = 40
        elif video_info.get('isSquare'):
            settings['fontSize'] = 26
            settings['marginV'] = 35

        # Apply user style overrides
        if style:
            settings.update(style)

        return settings


def create_subtitle_file(transcription_data, output_path, subtitle_positions=None, video_path=None):
    """Create subtitle file from transcription data"""
    # Use ASS format for custom positioning, SRT for standard placement

    if subtitle_positions and any(pos.get('position') for pos in subtitle_positions):
        # Custom positioning data available - use ASS format
        if not output_path.endswith('.ass'):
            output_path = output_path.replace('.srt', '.ass')

        print(f"[DEBUG] Using ASS format for custom positioning")
        create_ass_file(transcription_data, output_path,
                        subtitle_positions, video_path)
    else:
        # No custom positioning - use SRT format (more reliable)
        if output_path.endswith('.ass'):
            output_path = output_path.replace('.ass', '.srt')

        print(f"[DEBUG] Using SRT format for standard positioning")
        create_srt_file(transcription_data, output_path)

    return output_path


def create_srt_file(transcription_data, srt_path):
    """Create SRT subtitle file from transcription data"""
    print(f"[DEBUG] Creating SRT file: {srt_path}")

    segments = transcription_data.get('segments', [])
    print(f"[DEBUG] Processing {len(segments)} segments for SRT")

    with open(srt_path, 'w', encoding='utf-8') as f:
        for i, segment in enumerate(segments):
            start = segment['start']
            end = segment['end']
            text = segment['text'].strip()

            # Skip empty segments
            if not text:
                continue

            start_time = format_srt_time(start)
            end_time = format_srt_time(end)

            # Write SRT entry
            f.write(f"{i+1}\n")
            f.write(f"{start_time} --> {end_time}\n")
            f.write(f"{text}\n")
            f.write("\n")

            if i < 3:  # Only show first 3 entries
                print(
                    f"[DEBUG] SRT entry {i+1}: {start_time} --> {end_time} | {text[:30]}...")

    print(f"[DEBUG] SRT file creation completed")


def create_ass_file(transcription_data, ass_path, subtitle_positions, video_path=None):
    """Create ASS subtitle file with positioning data"""
    print(f"[DEBUG] Creating ASS file: {ass_path}")
    print(f"[DEBUG] Subtitle positions data: {subtitle_positions}")

    try:
        # Get video info for positioning calculations
        video_info = get_video_info(video_path) if video_path else {
            'width': 1920, 'height': 1080}
        print(f"[DEBUG] Video info for ASS: {video_info}")

        # ASS file header with proper video resolution
        ass_content = f"""[Script Info]
Title: Generated Subtitles
ScriptType: v4.00+
PlayResX: {video_info['width']}
PlayResY: {video_info['height']}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,48,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,3,0,2,50,50,50,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""

        segments = transcription_data.get('segments', [])
        print(f"[DEBUG] Processing {len(segments)} segments for ASS")

        for i, segment in enumerate(segments):
            start_time = format_ass_time(segment['start'])
            end_time = format_ass_time(segment['end'])
            text = segment['text'].strip()

            if not text:
                print(f"[DEBUG] Skipping empty segment {i}")
                continue

            # Find matching position data
            position = find_position_for_segment(
                segment, subtitle_positions, i)
            print(f"[DEBUG] Segment {i}: position = {position}")

            if position:
                # Apply positioning - convert percentage to pixels if needed
                # Handle both percentage (0-100) and pixel formats
                if position.get('position'):
                    # Frontend format: { position: { x: 10, y: 80 } } (percentages)
                    pos_data = position['position']
                    x = int((pos_data.get('x', 50) / 100)
                            * video_info['width'])
                    y = int((pos_data.get('y', 80) / 100)
                            * video_info['height'])
                    print(
                        f"[DEBUG] Using percentage positioning: {pos_data} -> ({x}, {y})")
                else:
                    # Direct format: { x: 320, y: 240 } (pixels)
                    x = position.get('x', video_info['width'] // 2)
                    y = position.get('y', int(video_info['height'] * 0.8))
                    print(f"[DEBUG] Using pixel positioning: ({x}, {y})")

                pos_tag = f"{{\\pos({x},{y})}}"
                text = pos_tag + text
                print(f"[DEBUG] Applied positioning tag: {pos_tag}")

            ass_content += f"Dialogue: 0,{start_time},{end_time},Default,,0,0,0,,{text}\n"

        print(f"[DEBUG] Writing ASS file to: {ass_path}")
        with open(ass_path, 'w', encoding='utf-8') as f:
            f.write(ass_content)

        print(f"[DEBUG] ASS file created successfully")

    except Exception as e:
        print(f"[DEBUG] Error creating ASS file: {e}")
        import traceback
        traceback.print_exc()
        raise


def find_position_for_segment(segment, subtitle_positions, segment_index):
    """Find best matching position for a segment"""
    if not subtitle_positions:
        return None

    # Try exact time match
    for pos in subtitle_positions:
        if (abs(pos.get('startTime', 0) - segment['start']) < 0.1 and
                abs(pos.get('endTime', 0) - segment['end']) < 0.1):
            return pos

    # Try text match
    for pos in subtitle_positions:
        if (pos.get('text', '').strip().lower() == segment['text'].strip().lower()):
            return pos

    # Use index-based match
    if segment_index < len(subtitle_positions):
        return subtitle_positions[segment_index]

    return subtitle_positions[0] if subtitle_positions else None


def format_srt_time(seconds):
    """Format seconds to SRT time format (HH:MM:SS,mmm)"""
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    milliseconds = int((seconds % 1) * 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{milliseconds:03d}"


def format_ass_time(seconds):
    """Format seconds to ASS time format (H:MM:SS.cc)"""
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    centiseconds = int((seconds % 1) * 100)
    return f"{hours}:{minutes:02d}:{secs:02d}.{centiseconds:02d}"


def get_video_info(video_path):
    """Get video information using ffprobe"""
    try:
        cmd = [
            'ffprobe', '-v', 'quiet', '-print_format', 'json',
            '-show_format', '-show_streams', video_path
        ]
        result = subprocess.run(cmd, capture_output=True,
                                text=True, check=True, timeout=30)
        info = json.loads(result.stdout)

        video_stream = next(
            (s for s in info['streams'] if s['codec_type'] == 'video'), None)
        if video_stream:
            width = int(video_stream['width'])
            height = int(video_stream['height'])
            aspect_ratio = width / height

            video_info = {
                'width': width,
                'height': height,
                'aspectRatio': aspect_ratio,
                'isVertical': aspect_ratio < 0.8,
                'isSquare': 0.8 <= aspect_ratio <= 1.2,
                'isWidescreen': aspect_ratio > 1.7
            }

            # Add duration if available
            if 'format' in info and 'duration' in info['format']:
                video_info['duration'] = float(info['format']['duration'])

            return video_info

    except subprocess.TimeoutExpired:
        print(f"Warning: ffprobe timed out for {video_path}")
    except subprocess.CalledProcessError as e:
        print(f"Warning: ffprobe failed: {e.stderr}")
    except json.JSONDecodeError as e:
        print(f"Warning: Could not parse ffprobe output: {e}")
    except Exception as e:
        print(f"Warning: Could not get video info: {e}")

    # Return sensible defaults for 1080p video
    print("Using default video info (1920x1080)")
    return {'width': 1920, 'height': 1080, 'aspectRatio': 1.78, 'isVertical': False, 'isSquare': False, 'isWidescreen': True}


def main():
    parser = argparse.ArgumentParser(
        description='Add subtitle overlay to video')
    parser.add_argument('video_path', help='Path to input video file')
    parser.add_argument('transcription_data',
                        help='Transcription data as JSON string')
    parser.add_argument(
        'output_path', help='Path for output video with subtitles')
    parser.add_argument(
        '--text-style', help='Text style settings as JSON string')
    parser.add_argument('--subtitle-positions',
                        help='Subtitle positioning data as JSON string')

    args = parser.parse_args()

    # Parse JSON arguments
    try:
        transcription_data = json.loads(args.transcription_data)
        text_style = json.loads(args.text_style) if args.text_style else {}
        subtitle_positions = json.loads(
            args.subtitle_positions) if args.subtitle_positions else []
    except json.JSONDecodeError as e:
        print(f"Error parsing JSON arguments: {e}", file=sys.stderr)
        sys.exit(1)

    try:
        # Get video information directly from video file
        print(f"[INFO] Getting video information from {args.video_path}")
        video_info = get_video_info(args.video_path)
        print(
            f"[INFO] Video info: {video_info['width']}x{video_info['height']} (AR: {video_info['aspectRatio']:.2f})")

        # Create temporary subtitle file (SRT or ASS based on positioning)
        video_name = Path(args.video_path).stem
        subtitle_path_template = f"{video_name}_temp.srt"

        print(f"[DEBUG] Creating subtitle file: {subtitle_path_template}")
        print(
            f"[DEBUG] Transcription segments: {len(transcription_data.get('segments', []))}")
        print(f"[DEBUG] Subtitle positions: {len(subtitle_positions)}")

        # create_subtitle_file returns the actual path (might be .ass instead of .srt)
        actual_subtitle_path = create_subtitle_file(transcription_data, subtitle_path_template,
                                                    subtitle_positions, args.video_path)

        print(f"[DEBUG] Actual subtitle file created: {actual_subtitle_path}")

        # Verify subtitle file was created and show content preview
        if Path(actual_subtitle_path).exists():
            with open(actual_subtitle_path, 'r', encoding='utf-8') as f:
                content = f.read()
                print(
                    f"[DEBUG] Subtitle file created, size: {len(content)} characters")
                print(f"[DEBUG] First 200 characters: {content[:200]}...")
        else:
            print(f"[DEBUG] ERROR: Subtitle file was not created!")
            sys.exit(1)

        # Create overlay
        overlay = OverlaySubtitles(
            video_path=args.video_path,
            subtitle_file_path=actual_subtitle_path,
            style=text_style,
            video_info=video_info
        )

        result_path = overlay.add_subtitles(args.output_path)

        # Clean up temporary subtitle file
        try:
            os.remove(actual_subtitle_path)
        except:
            pass

        print(f"Success: {result_path}")

    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
