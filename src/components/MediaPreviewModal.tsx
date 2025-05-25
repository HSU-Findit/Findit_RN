// MediaPreviewModal.tsx
import { MaterialIcons } from '@expo/vector-icons';
import { ImagePickerAsset } from 'expo-image-picker';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Keyboard,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import Modal from 'react-native-modal';
import { getThemedStyles } from '../styles/MediaPreviewModal.styles';
import ImagePreview from './ImagePreview';

import type { OcrResult } from '../api/googleVisionApi';

interface MediaPreviewModalProps {
  visible: boolean;
  onClose: () => void;
  mediaAsset: ImagePickerAsset | null;
  ocrResult: OcrResult | null;
  isLoadingOcr: boolean;
  colorScheme: 'light' | 'dark';
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  analysisResult: {
    objects: Array<{
      name: string;
      confidence: number;
      boundingBox: Array<{ x: number; y: number }>;
    }>;
  } | null;
  children?: React.ReactNode;
}

const MediaPreviewModal: React.FC<MediaPreviewModalProps> = ({
  visible,
  onClose,
  mediaAsset,
  ocrResult,
  isLoadingOcr,
  colorScheme,
  searchTerm,
  setSearchTerm,
  analysisResult = null,
  children,
}) => {
  const [textFieldValue, setTextFieldValue] = useState('');
  const [modalHeight, setModalHeight] = useState(0.8);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const searchFieldPosition = new Animated.Value(0);
  const underlineAnim = useRef(new Animated.Value(0)).current;

  // 텍스트 입력 변경 핸들러
  const handleTextChange = (text: string) => {
    setTextFieldValue(text);
    setSearchTerm(text);
  };

  useEffect(() => {
    if (mediaAsset) {
      const screenHeight = Dimensions.get('window').height;
      const screenWidth = Dimensions.get('window').width;
      const imageRatio = mediaAsset.width / mediaAsset.height;
      const screenRatio = screenWidth / screenHeight;

      let heightRatio = 0.8;
      if (imageRatio < screenRatio) {
        // 세로로 긴 이미지: 더 많은 화면을 사용
        heightRatio = Math.min(0.95, mediaAsset.height / screenHeight + 0.15);
      } else {
        // 가로로 넓은 이미지: 기본값 또는 더 작은 값
        heightRatio = 0.7;
      }
      setModalHeight(heightRatio);
    }
  }, [mediaAsset]);

  useEffect(() => {
    const keyboardWillShow = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
        Animated.timing(searchFieldPosition, {
          toValue: -e.endCoordinates.height,
          duration: 250,
          useNativeDriver: true,
        }).start();
      }
    );

    const keyboardWillHide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
        Animated.timing(searchFieldPosition, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }).start();
      }
    );

    return () => {
      keyboardWillShow.remove();
      keyboardWillHide.remove();
    };
  }, []);

  useEffect(() => {
    Animated.timing(underlineAnim, {
      toValue: textFieldValue.length > 0 ? 1 : 0,
      duration: 250,
      useNativeDriver: false,
    }).start();
  }, [textFieldValue]);

  if (!mediaAsset) {
    return null;
  }

  const isDarkMode = colorScheme === 'dark';
  const { styles, closeButtonIconColor, placeholderTextColor } = getThemedStyles(isDarkMode);

  return (
    <Modal
      isVisible={visible}
      onBackdropPress={onClose}
      onSwipeComplete={onClose}
      swipeDirection={['down']}
      style={styles.modal}
      backdropOpacity={0.4}
      animationIn="slideInUp"
      animationOut="slideOutDown"
      propagateSwipe={true}
      statusBarTranslucent={true}
    >
      <View style={[styles.bottomSheet, { height: `${modalHeight * 100}%` }]}>
        <View style={styles.bottomSheetHeader}>
          <View style={styles.bottomSheetHandle} />
        </View>
        
        <View style={styles.bottomSheetContent}>
          <View style={styles.previewTitleContainer}>
            <Text style={styles.previewTitle}>Find it</Text>
            <Text style={[styles.previewTitle, styles.previewTitleDot]}>!</Text>
          </View>

          <View style={{ flex: 1 }}>
            <ImagePreview
              image={mediaAsset}
              ocrResult={ocrResult}
              isLoadingOcr={isLoadingOcr}
              searchTerm={searchTerm}
              analysisResult={analysisResult}
            />
          </View>

          <Animated.View
            style={[
              styles.textFieldWrapper,
              {
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: Platform.OS === 'ios' ? Math.max(0, keyboardHeight - 19) : keyboardHeight + 5,
                zIndex: 1000,
                backgroundColor: styles.textFieldWrapper.backgroundColor,
              }
            ]}
          >
            <View style={styles.textFieldContainerRow}>
              <TextInput
                style={styles.textInput}
                placeholder="텍스트를 입력하세요..."
                placeholderTextColor={placeholderTextColor}
                value={textFieldValue}
                onChangeText={handleTextChange}
                returnKeyType="search"
              />

              <TouchableOpacity
                style={styles.clearButton}
                onPress={() => {
                  if (textFieldValue.length > 0) {
                    setTextFieldValue('');
                    setSearchTerm('');
                  }
                }}
                accessibilityLabel="입력 지우기"
                activeOpacity={textFieldValue.length > 0 ? 0.7 : 1}
              >
                <MaterialIcons name="close" size={20} color={textFieldValue.length > 0 ? '#888' : '#ddd'} />
              </TouchableOpacity>
            </View>

            <Animated.View
              style={{
                height: 1,
                backgroundColor: underlineAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['#efefef', '#4299E2']
                }),
                marginTop: 2
              }}
            />
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
};

export default MediaPreviewModal;