"""
Content Analyzer for AI Video Editor

This module analyzes video transcripts using OpenAI's GPT models with structured outputs
to identify engaging video clips. It includes robust error handling for OpenAI API
response parsing and compatibility with different OpenAI library versions.

Fixed Issue: Handle 'ParsedChatCompletion' object has no attribute 'parsed' error
by trying multiple response access patterns and providing detailed debugging information.
"""

import json
import sys
import argparse
from typing import List, Dict, Any
import openai
from openai import OpenAI
from pydantic import BaseModel


class VideoClip(BaseModel):
    start_time: float
    end_time: float
    description: str


class VideoClipsAnalysis(BaseModel):
    clips: List[VideoClip]


class ContentAnalyzer:
    def __init__(self, openai_api_key=None, debug=False):
        """
        Initialize content analyzer with GPT for clip identification
        Args:
            openai_api_key (str): OpenAI API key for GPT analysis
            debug (bool): Enable debug logging for troubleshooting
        """
        if openai_api_key:
            self.client = OpenAI(api_key=openai_api_key)
        else:
            self.client = None
        self.debug = debug

    def check_openai_version(self):
        """Check OpenAI library version and provide recommendations."""
        try:
            version = openai.__version__
            if self.debug:
                print(f"Debug: OpenAI library version: {version}")

            # Parse version to check if it's recent enough for structured outputs
            version_parts = version.split('.')
            major = int(version_parts[0])
            minor = int(version_parts[1]) if len(version_parts) > 1 else 0

            # Structured outputs require OpenAI library >= 1.40.0 (approximate)
            if major < 1 or (major == 1 and minor < 40):
                return {
                    "warning": f"OpenAI library version {version} may not fully support structured outputs. Consider upgrading to >= 1.40.0"
                }

            return {"version": version, "compatible": True}
        except Exception as e:
            return {"error": f"Could not check OpenAI version: {str(e)}"}

    def analyze_transcript_with_gpt(self, transcript_data: Dict) -> Dict:
        """
        Analyze transcript using GPT to identify clips with exact timestamps
        """
        if not self.client:
            return {"error": "OpenAI API key not provided"}

        # Check OpenAI library version for compatibility
        version_check = self.check_openai_version()
        if "warning" in version_check and self.debug:
            print(f"Warning: {version_check['warning']}")
        elif "error" in version_check and self.debug:
            print(f"Version check error: {version_check['error']}")

        # Get segments with timestamps
        segments = transcript_data.get('segments', [])
        if not segments:
            return {"error": "No transcript segments found"}

        # Create formatted transcript with timestamps
        transcript_with_timestamps = []
        for segment in segments:
            transcript_with_timestamps.append(
                f"[{segment['start']:.2f}s - {segment['end']:.2f}s]: {segment['text']}"
            )

        formatted_transcript = '\n'.join(
            transcript_with_timestamps[:100])  # Limit to avoid token limits

        system_message = """You are an expert video content analyzer specializing in identifying engaging moments for short-form content.
        You will analyze timestamped video transcripts and extract the most compelling clips that would work well for social media, marketing, or content creation."""

        user_message = f"""Analyze this timestamped video transcript and identify the most engaging clips for short-form content.

        Transcript with timestamps:
        {formatted_transcript}

        Requirements:
        - Use EXACT start_time and end_time values from the transcript
        - Identify 3-8 clips maximum
        - Each clip should be 30-90 seconds long
        - Focus on complete thoughts or segments
        - Choose the most engaging, shareable moments (high energy, valuable insights, emotional peaks, actionable content)
        - Provide a brief description of why each clip is engaging"""

        try:
            response = self.client.beta.chat.completions.parse(
                model="gpt-4o-2024-08-06",
                messages=[
                    {"role": "system", "content": system_message},
                    {"role": "user", "content": user_message}
                ],
                response_format=VideoClipsAnalysis,
                temperature=0.2
            )

            # Handle different response structures for OpenAI structured output
            analysis_result = None

            # Debug: Log response structure if debug mode is enabled
            if self.debug:
                print(f"Debug: Response type: {type(response)}")
                print(f"Debug: Response attributes: {dir(response)}")
                if hasattr(response, 'choices'):
                    print(
                        f"Debug: Response choices length: {len(response.choices)}")
                    if len(response.choices) > 0:
                        print(
                            f"Debug: First choice message attributes: {dir(response.choices[0].message)}")

            # Try different ways to access the parsed result
            if hasattr(response, 'parsed'):
                analysis_result = response.parsed
                if self.debug:
                    print("Debug: Successfully accessed response.parsed")
            elif hasattr(response, 'choices') and len(response.choices) > 0:
                # Alternative: access via choices[0].message.parsed
                if hasattr(response.choices[0].message, 'parsed'):
                    analysis_result = response.choices[0].message.parsed
                    if self.debug:
                        print(
                            "Debug: Successfully accessed response.choices[0].message.parsed")
                elif hasattr(response.choices[0].message, 'content'):
                    # Fallback: try to parse JSON content manually
                    try:
                        content = response.choices[0].message.content
                        if self.debug:
                            print(
                                f"Debug: Attempting to parse JSON content: {content[:200]}...")
                        parsed_json = json.loads(content)
                        # Create VideoClipsAnalysis instance from parsed JSON
                        analysis_result = VideoClipsAnalysis(**parsed_json)
                        if self.debug:
                            print("Debug: Successfully parsed JSON content manually")
                    except (json.JSONDecodeError, TypeError, ValueError) as json_error:
                        return {"error": f"Failed to parse JSON response: {str(json_error)}"}

            if analysis_result is None:
                error_details = f"Response type: {type(response)}, Response attributes: {dir(response)}"
                return {"error": f"Could not extract parsed result from OpenAI response. Response structure may have changed. {error_details}"}

            # Convert Pydantic model to dict for compatibility
            clips_data = []
            for clip in analysis_result.clips:
                clips_data.append({
                    "start_time": clip.start_time,
                    "end_time": clip.end_time,
                    "description": clip.description
                })

            return {"clips": clips_data}

        except AttributeError as attr_error:
            return {"error": f"GPT analysis failed - attribute error: {str(attr_error)}. This may indicate an OpenAI library version compatibility issue."}
        except Exception as e:
            return {"error": f"GPT analysis failed: {str(e)}"}

    def analyze_content(self, transcript_data: Dict) -> Dict:
        """
        Analyze content using only GPT to identify clips with timestamps
        """
        # Get basic metadata
        segments = transcript_data.get('segments', [])
        total_duration = segments[-1]['end'] if segments else 0

        # Get GPT analysis with clip recommendations
        gpt_analysis = self.analyze_transcript_with_gpt(transcript_data)

        return {
            'timestamp': transcript_data.get('timestamp'),
            'language': transcript_data.get('language'),
            'total_duration': total_duration,
            'clips': gpt_analysis.get('clips', []),
            'error': gpt_analysis.get('error')
        }


def main():
    parser = argparse.ArgumentParser(
        description='Analyze video content for AI processing')
    parser.add_argument('transcript_path', help='Path to transcript JSON file')
    parser.add_argument(
        'output_path', help='Path to output analysis JSON file')
    parser.add_argument('--openai-key', help='OpenAI API key')
    parser.add_argument('--debug', action='store_true',
                        help='Enable debug logging')

    args = parser.parse_args()

    # Load transcript
    with open(args.transcript_path, 'r', encoding='utf-8') as f:
        transcript_data = json.load(f)

    # Analyze content
    analyzer = ContentAnalyzer(args.openai_key, debug=args.debug)
    analysis = analyzer.analyze_content(transcript_data)

    # Save results
    with open(args.output_path, 'w', encoding='utf-8') as f:
        json.dump(analysis, f, indent=2, ensure_ascii=False)

    if analysis.get('error'):
        print(f"Analysis failed: {analysis['error']}")
        sys.exit(1)

    clips = analysis.get('clips', [])
    print(f"Content analysis completed")
    print(f"Found {len(clips)} clips for video editing")


if __name__ == "__main__":
    main()
