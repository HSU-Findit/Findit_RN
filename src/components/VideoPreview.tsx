import * as VideoThumbnails from 'expo-video-thumbnails';
import React, { useEffect, useState } from 'react';
import { Image, View } from 'react-native';
import { videoPreviewStyles } from '../styles/VideoPreview.styles';
import LoadingWave from './LoadingWave';

interface VideoPreviewProps {
  videoUri: string | null;
  onPress?: (uri: string) => void;
  isLoading?: boolean;
}

const VideoPreview: React.FC<VideoPreviewProps> = ({ videoUri, onPress, isLoading = false }) => {
  const [thumbnailUri, setThumbnailUri] = useState<string | null>(null);

  useEffect(() => {
    const generateThumbnail = async () => {
      try {
        if (!videoUri) return;
        
        const { uri } = await VideoThumbnails.getThumbnailAsync(videoUri, {
          time: Math.floor(Math.random() * 10000),
          quality: 0.7,
        });
        setThumbnailUri(uri);
      } catch (error) {
        console.error('Error generating thumbnail:', error);
      }
    };

    if (videoUri) {
      generateThumbnail();
    }
  }, [videoUri]);

  const handlePress = () => {
    if (videoUri && onPress) {
      onPress(videoUri);
    }
  };

  return (
    <View style={videoPreviewStyles.previewItemContainer}>
      {thumbnailUri ? (
        isLoading ? (
          <View style={videoPreviewStyles.previewMedia}>
            <Image
              source={{ uri: thumbnailUri }}
              style={videoPreviewStyles.previewMedia}
              resizeMode="cover"
            />
            <View style={videoPreviewStyles.darkOverlay}>
              <LoadingWave />
            </View>
          </View>
        ) : (
          <Image
            source={{ uri: thumbnailUri }}
            style={videoPreviewStyles.previewMedia}
            resizeMode="cover"
          />
        )
      ) : null}
    </View>
  );
};

export default VideoPreview;