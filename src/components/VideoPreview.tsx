import * as VideoThumbnails from 'expo-video-thumbnails';
import React, { useEffect, useState } from 'react';
import { Animated, Image, View } from 'react-native';
import { videoPreviewStyles } from '../styles/VideoPreview.styles';

interface VideoPreviewProps {
  videoUri: string | null;
  onPress?: (uri: string) => void;
  isLoading?: boolean;
}

const VideoPreview: React.FC<VideoPreviewProps> = ({ videoUri, onPress, isLoading = false }) => {
  const [thumbnailUri, setThumbnailUri] = useState<string | null>(null);
  const [animations] = useState([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]);

  useEffect(() => {
    const animate = () => {
      const sequences = animations.map((anim, index) => {
        return Animated.sequence([
          Animated.timing(anim, {
            toValue: 1,
            duration: 400,
            delay: index * 100,
            useNativeDriver: false,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 400,
            useNativeDriver: false,
          }),
        ]);
      });

      Animated.stagger(100, sequences).start(() => animate());
    };

    animate();
  }, []);

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
              <View style={videoPreviewStyles.loadingOverlay}>
                {animations.map((anim, index) => (
                  <Animated.View
                    key={index}
                    style={[
                      videoPreviewStyles.loadingBar,
                      {
                        opacity: anim,
                        transform: [
                          {
                            scaleY: anim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0.5, 1],
                            }),
                          },
                        ],
                      },
                    ]}
                  />
                ))}
              </View>
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