import subprocess
import os
from pathlib import Path

class OverlaySubtitles:
    def __init__(self, video_path: str = None, srt_file: str = None):
        self.video_path = video_path
        self.srt_file = srt_file

    def add_subtitles(self, video_path: str = None, srt_file: str = None, output_path: str = None):
        """
        Add subtitles to video using FFmpeg
        Args:
            video_path: Path to input video file
            srt_file: Path to SRT subtitle file
            output_path: Path for output video with subtitles
        Returns:
            str: Path to output video file
        """
        # Use provided paths or fallback to instance variables
        video_input = video_path or self.video_path
        subtitle_file = srt_file or self.srt_file
        
        if not video_input or not subtitle_file:
            raise ValueError("Both video_path and srt_file must be provided")
        
        # Generate output path if not provided
        if not output_path:
            video_name = Path(video_input).stem
            output_path = str(Path(video_input).parent / f"{video_name}_with_subtitles.mp4")
        
        try:
            # Cross-platform FFmpeg subtitle handling
            import platform
            
            if platform.system() == 'Windows':
                # Windows: Convert backslashes and escape colons
                escaped_subtitle = subtitle_file.replace('\\', '/').replace(':', '\\:')
            else:
                # Linux/Mac: Escape special characters for shell
                escaped_subtitle = subtitle_file.replace("'", "'\"'\"'")
            
            # Use FFmpeg to burn subtitles into video
            cmd = [
                "ffmpeg", 
                "-i", video_input,
                "-vf", f"subtitles={escaped_subtitle}",
                "-c:a", "copy",  # Copy audio without re-encoding
                "-y",  # Overwrite output file
                output_path
            ]
            
            result = subprocess.run(cmd, 
                                  capture_output=True, 
                                  text=True, 
                                  check=True)
            
            print(f"Subtitles added successfully: {output_path}")
            return output_path
            
        except subprocess.CalledProcessError as e:
            print(f"FFmpeg error: {e.stderr}")
            raise Exception(f"Failed to add subtitles: {e.stderr}")
        except Exception as e:
            print(f"Error adding subtitles: {e}")
            raise