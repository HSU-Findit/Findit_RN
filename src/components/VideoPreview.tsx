import { MaterialIcons } from '@expo/vector-icons';
import * as VideoThumbnails from 'expo-video-thumbnails';
import React, { useEffect, useState } from 'react';
import { Image, TouchableOpacity, View } from 'react-native';
import { videoPreviewStyles } from '../styles/VideoPreview.styles';

interface VideoPreviewProps {
  videoUri: string | null;
  onPress?: (uri: string) => void;
}

const VideoPreview: React.FC<VideoPreviewProps> = ({ videoUri, onPress }) => {
  const [thumbnailUri, setThumbnailUri] = useState<string | null>(null);

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

  useEffect(() => {
    if (videoUri) {
      generateThumbnail();
    }
  }, [videoUri]);

  const handlePress = () => {
    if (thumbnailUri && onPress) {
      onPress(thumbnailUri);
    }
  };

  return (
    <TouchableOpacity onPress={handlePress} style={videoPreviewStyles.previewItemContainer}>
      {thumbnailUri ? (
        <Image
          source={{ uri: thumbnailUri }}
          style={videoPreviewStyles.previewMedia}
          resizeMode="cover"
        />
      ) : null}
      <View style={videoPreviewStyles.playButton}>
        <MaterialIcons name="play-circle-filled" size={32} color="#fff" />
      </View>
    </TouchableOpacity>
  );
};

export default VideoPreview;