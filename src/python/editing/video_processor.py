import os
import json
import sys
import argparse
from pathlib import Path
from moviepy.editor import *
import numpy as np

class VideoProcessor:
    def __init__(self, temp_dir="temp"):
        """
        Initialize video processor
        Args:
            temp_dir (str): Directory for temporary files
        """
        self.temp_dir = Path(temp_dir)
        self.temp_dir.mkdir(exist_ok=True)
    
    def extract_audio(self, video_path: str, output_path: str = None) -> str:
        """
        Extract audio from video file
        Args:
            video_path (str): Path to input video
            output_path (str): Path for output audio file
        Returns:
            str: Path to extracted audio file
        """
        if output_path is None:
            video_name = Path(video_path).stem
            output_path = self.temp_dir / f"{video_name}_audio.wav"
        
        try:
            video = VideoFileClip(video_path)
            audio = video.audio
            audio.write_audiofile(str(output_path), verbose=False, logger=None)
            
            video.close()
            audio.close()
            
            return str(output_path)
            
        except Exception as e:
            raise Exception(f"Audio extraction failed: {str(e)}")
    
    def get_video_info(self, video_path: str) -> dict:
        """
        Get basic video information
        """
        try:
            video = VideoFileClip(video_path)
            info = {
                'duration': video.duration,
                'fps': video.fps,
                'size': video.size,
                'width': video.w,
                'height': video.h,
                'aspect_ratio': video.w / video.h,
                'has_audio': video.audio is not None
            }
            video.close()
            return info
            
        except Exception as e:
            return {'error': str(e)}
    
    def create_clip(self, video_path: str, start_time: float, end_time: float, 
                   output_path: str = None, target_aspect='9:16') -> str:
        """
        Create a short clip from video
        Args:
            video_path (str): Path to source video
            start_time (float): Start time in seconds
            end_time (float): End time in seconds
            output_path (str): Output path for clip
            target_aspect (str): Target aspect ratio ('9:16', '1:1', '16:9')
        Returns:
            str: Path to created clip
        """
        if output_path is None:
            video_name = Path(video_path).stem
            output_path = self.temp_dir / f"{video_name}_clip_{int(start_time)}_{int(end_time)}.mp4"
        
        try:
            # Load video and create subclip
            video = VideoFileClip(video_path)
            clip = video.subclip(start_time, end_time)
            
            # Adjust aspect ratio if needed
            if target_aspect == '9:16':
                # Portrait mode for shorts
                target_width = 1080
                target_height = 1920
            elif target_aspect == '1:1':
                # Square format
                target_width = 1080
                target_height = 1080
            else:
                # Keep original or 16:9
                target_width = clip.w
                target_height = clip.h
            
            # Resize and crop if needed
            if target_aspect in ['9:16', '1:1']:
                # Calculate crop dimensions to maintain content
                scale_factor = max(target_width / clip.w, target_height / clip.h)
                
                # Resize first
                clip_resized = clip.resize(scale_factor)
                
                # Crop to target size (center crop)
                clip_final = clip_resized.crop(
                    x_center=clip_resized.w/2,
                    y_center=clip_resized.h/2,
                    width=target_width,
                    height=target_height
                )
            else:
                clip_final = clip
            
            # Write the final clip
            clip_final.write_videofile(
                str(output_path),
                codec='libx264',
                audio_codec='aac',
                verbose=False,
                logger=None
            )
            
            # Clean up
            video.close()
            clip.close()
            clip_final.close()
            
            return str(output_path)
            
        except Exception as e:
            raise Exception(f"Clip creation failed: {str(e)}")
    
    def add_captions(self, video_path: str, captions_data: list, 
                    output_path: str = None) -> str:
        """
        Add captions to video
        Args:
            video_path (str): Path to input video
            captions_data (list): List of caption segments with timing
            output_path (str): Output path for video with captions
        Returns:
            str: Path to video with captions
        """
        return self.add_captions_with_style(video_path, captions_data, output_path)
    
    def add_captions_with_style(self, video_path: str, captions_data: list, 
                               output_path: str = None, fontsize: int = 50,
                               color: str = 'white', stroke_color: str = 'black',
                               stroke_width: int = 2, position: str = 'bottom') -> str:
        """
        Add captions to video with custom styling
        Args:
            video_path (str): Path to input video
            captions_data (list): List of caption segments with timing
            output_path (str): Output path for video with captions
            fontsize (int): Font size for text
            color (str): Text color
            stroke_color (str): Stroke color
            stroke_width (int): Stroke width
            position (str): Text position ('bottom', 'top', 'center')
        Returns:
            str: Path to video with captions
        """
        if output_path is None:
            video_name = Path(video_path).stem
            output_path = self.temp_dir / f"{video_name}_with_captions.mp4"
        
        try:
            print(f"Starting caption addition for video: {video_path}")
            print(f"Caption count: {len(captions_data)}")
            print(f"Text style - fontsize: {fontsize}, color: {color}, position: {position}")
            
            video = VideoFileClip(video_path)
            
            # Determine text position
            if position == 'top':
                text_position = ('center', 'top')
            elif position == 'center':
                text_position = 'center'
            else:  # default to bottom
                text_position = ('center', 'bottom')
            
            # Create text clips for each caption
            text_clips = []
            for caption in captions_data:
                try:
                    # Method 1: Try standard TextClip first
                    txt_clip = TextClip(
                        caption['text'],
                        fontsize=fontsize,
                        color=color
                    ).set_start(caption['start']).set_duration(
                        caption['end'] - caption['start']
                    ).set_position(text_position)
                    
                    text_clips.append(txt_clip)
                    print(f"Created text clip: '{caption['text'][:50]}...'")
                    
                except Exception as text_error:
                    print(f"Method 1 failed for '{caption['text'][:50]}...': {text_error}")
                    try:
                        # Method 2: Try with minimal parameters
                        txt_clip = TextClip(
                            caption['text'],
                            fontsize=50,
                            color='white'
                        ).set_start(caption['start']).set_duration(
                            caption['end'] - caption['start']
                        ).set_position('center')
                        
                        text_clips.append(txt_clip)
                        print(f"Created text clip (method 2): '{caption['text'][:50]}...'")
                        
                    except Exception as text_error2:
                        print(f"Method 2 also failed for '{caption['text'][:50]}...': {text_error2}")
                        # Skip this caption entirely
            
            # Composite video with captions
            print(f"Compositing video with {len(text_clips)} text clips...")
            final_video = CompositeVideoClip([video] + text_clips)
            
            # Write output
            print(f"Writing video with captions to: {output_path}")
            final_video.write_videofile(
                str(output_path),
                codec='libx264',
                audio_codec='aac',
                verbose=True,  # Enable verbose output for progress
                logger=None
            )
            print(f"Video with captions completed: {output_path}")
            
            # Clean up
            video.close()
            final_video.close()
            for clip in text_clips:
                clip.close()
            
            return str(output_path)
            
        except Exception as e:
            raise Exception(f"Caption addition failed: {str(e)}")
    
    def generate_thumbnail(self, video_path: str, time_point: float = None,
                          output_path: str = None) -> str:
        """
        Generate thumbnail from video at specific time point
        """
        if output_path is None:
            video_name = Path(video_path).stem
            output_path = self.temp_dir / f"{video_name}_thumbnail.jpg"
        
        try:
            video = VideoFileClip(video_path)
            
            # Use middle of video if no time specified
            if time_point is None:
                time_point = video.duration / 2
            
            # Extract frame and save as image
            frame = video.get_frame(time_point)
            video.close()
            
            # Convert numpy array to PIL Image and save
            from PIL import Image
            image = Image.fromarray(frame)
            image.save(output_path)
            
            return str(output_path)
            
        except Exception as e:
            raise Exception(f"Thumbnail generation failed: {str(e)}")
    
    def process_video_for_analysis(self, video_path: str) -> dict:
        """
        Process video for AI analysis pipeline
        Returns paths to extracted audio and basic info
        """
        try:
            # Get video info
            video_info = self.get_video_info(video_path)
            
            # Extract audio for transcription
            audio_path = self.extract_audio(video_path)
            
            # Generate thumbnail
            thumbnail_path = self.generate_thumbnail(video_path)
            
            return {
                'success': True,
                'video_info': video_info,
                'audio_path': audio_path,
                'thumbnail_path': thumbnail_path,
                'original_video': video_path
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }

def main():
    parser = argparse.ArgumentParser(description='Process video files')
    parser.add_argument('video_path', help='Path to input video')
    parser.add_argument('--command', choices=['info', 'extract_audio', 'create_clip', 'thumbnail', 'add_captions'], 
                       default='info', help='Processing command')
    parser.add_argument('--start', type=float, help='Start time for clip creation')
    parser.add_argument('--end', type=float, help='End time for clip creation')
    parser.add_argument('--output', help='Output file path')
    parser.add_argument('--captions-data', help='JSON string of captions data')
    parser.add_argument('--font-size', type=int, default=50, help='Font size for captions')
    parser.add_argument('--font-color', default='white', help='Font color for captions')
    parser.add_argument('--stroke-color', default='black', help='Stroke color for captions')
    parser.add_argument('--stroke-width', type=int, default=2, help='Stroke width for captions')
    parser.add_argument('--position', default='bottom', help='Caption position')
    
    args = parser.parse_args()
    
    processor = VideoProcessor()
    
    try:
        if args.command == 'info':
            info = processor.get_video_info(args.video_path)
            print(json.dumps(info, indent=2))
            
        elif args.command == 'extract_audio':
            audio_path = processor.extract_audio(args.video_path, args.output)
            print(f"Audio extracted to: {audio_path}")
            
        elif args.command == 'create_clip':
            if args.start is None or args.end is None:
                print("Error: --start and --end times required for clip creation")
                sys.exit(1)
            clip_path = processor.create_clip(args.video_path, args.start, args.end, args.output)
            print(f"Clip created: {clip_path}")
            
        elif args.command == 'thumbnail':
            thumbnail_path = processor.generate_thumbnail(args.video_path, output_path=args.output)
            print(f"Thumbnail created: {thumbnail_path}")
            
        elif args.command == 'add_captions':
            if args.captions_data is None:
                print("Error: --captions-data required for add_captions command")
                sys.exit(1)
            
            try:
                captions_data = json.loads(args.captions_data)
                
                # Update the add_captions method call to use new parameters
                video_with_captions = processor.add_captions_with_style(
                    args.video_path, 
                    captions_data, 
                    args.output,
                    fontsize=args.font_size,
                    color=args.font_color,
                    stroke_color=args.stroke_color,
                    stroke_width=args.stroke_width,
                    position=args.position
                )
                print(f"Video with captions created: {video_with_captions}")
                
            except json.JSONDecodeError:
                print("Error: Invalid JSON in --captions-data")
                sys.exit(1)
            
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()