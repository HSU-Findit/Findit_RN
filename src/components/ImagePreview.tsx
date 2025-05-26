import { ResizeMode, Video } from 'expo-av';
import { ImagePickerAsset } from 'expo-image-picker';
import React, { useEffect, useRef, useState } from 'react';
import { Image, Keyboard, TouchableWithoutFeedback, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring
} from 'react-native-reanimated';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';
import type { OcrResult } from '../api/googleVisionApi';
import { englishToKorean, koreanToEnglish } from '../constants/languageMapping';
import { imagePreviewStyles as styles } from '../styles/ImagePreview.styles';
import LoadingWave from './LoadingWave';

interface ImageLayout {
  width: number;
  height: number;
}

interface ImagePreviewProps {
  image: ImagePickerAsset;
  ocrResult: OcrResult | null;
  isLoadingOcr: boolean;
  searchTerm?: string;
  analysisResult?: {
    objects: Array<{
      name: string;
      confidence: number;
      boundingBox: Array<{ x: number; y: number }>;
    }>;
  } | null;
}

const ImagePreview: React.FC<ImagePreviewProps> = ({ 
  image, 
  ocrResult, 
  isLoadingOcr, 
  searchTerm = '',
  analysisResult = null 
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [imageLayout, setImageLayout] = useState<ImageLayout | null>(null);
  const [containerLayout, setContainerLayout] = useState<ImageLayout | null>(null);
  const [imageNaturalSize, setImageNaturalSize] = useState<{ width: number; height: number } | null>(null);
  
  // 확대/축소 및 이동을 위한 애니메이션 값
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const offsetX = useSharedValue(0);
  const offsetY = useSharedValue(0);
  const savedOffsetX = useSharedValue(0);
  const savedOffsetY = useSharedValue(0);

  // 원본 이미지 크기 가져오기
  React.useEffect(() => {
    if (image?.uri) {
      Image.getSize(
        image.uri,
        (w: number, h: number) => setImageNaturalSize({ width: w, height: h }),
        () => setImageNaturalSize(null)
      );
    }
  }, [image?.uri]);

  // 이미지가 실제로 렌더링된 크기 측정
  const onContainerLayout = (e: any) => {
    const { width, height } = e.nativeEvent.layout;
    setContainerLayout({ width, height });
  };

  const onImageLayout = (e: any) => {
    const { width, height } = e.nativeEvent.layout;
    setImageLayout({ width, height });
  };

  // 실제 이미지가 View 내에서 차지하는 영역 계산
  function getContainedImageLayout(
    containerW: number,
    containerH: number,
    imgW: number,
    imgH: number
  ) {
    const containerRatio = containerW / (containerH * 0.6);
    const imageRatio = imgW / imgH;
    let width = containerW;
    let height = containerH * 0.6;
    let offsetX = 0;
    let offsetY = 0;
    if (imageRatio > containerRatio) {
      width = containerW;
      height = containerW / imageRatio;
      offsetY = (containerH * 0.6 - height) / 2;
    } else {
      height = containerH * 0.6;
      width = height * imageRatio;
      offsetX = (containerW - width) / 2;
    }
    return { width, height, offsetX, offsetY };
  }

  const videoRef = useRef<Video>(null);

  const handleVideoPress = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pauseAsync();
      } else {
        videoRef.current.playAsync();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const stopPropagation = (e: any) => {
    e.stopPropagation();
    Keyboard.dismiss();
  };

  // 검색어와 일치하는 OCR 결과만 필터링
  const matches = ocrResult && searchTerm.length > 0
    ? ocrResult.textBoxes.filter(item => {
        if (item.description.length > 100) return false;
        return item.description.toLowerCase().includes(searchTerm.toLowerCase());
      })
    : [];
    
  const fullTextMatch = ocrResult && searchTerm.length > 0
    ? ocrResult.fullText.toLowerCase().includes(searchTerm.toLowerCase())
    : false;

  // 검색어와 일치하는 물체 결과 필터링
  const objectMatches = analysisResult && searchTerm.length > 0
    ? analysisResult.objects.filter(obj => {
        // 물체 이름의 부분 일치도 검색되도록 수정
        const objName = obj.name.toLowerCase();
        const searchTermLower = searchTerm.toLowerCase();
        
        // 검색어가 한글인 경우
        if (/[가-힣]/.test(searchTermLower)) {
          const englishTerms = koreanToEnglish[searchTermLower] || [];
          return englishTerms.some(term => objName.includes(term));
        }
        
        // 검색어가 영어인 경우
        const koreanTerms = englishToKorean[searchTermLower] || [];
        return objName.includes(searchTermLower) || koreanTerms.some(term => objName.includes(term));
      })
    : [];

  // 검색어가 변경될 때마다 결과 업데이트
  useEffect(() => {
    if (searchTerm.length > 0) {
      // 검색어가 있을 때만 결과 업데이트
      const newMatches = ocrResult?.textBoxes.filter(item => {
        if (item.description.length > 100) return false;
        return item.description.toLowerCase().includes(searchTerm.toLowerCase());
      }) || [];

      const newFullTextMatch = ocrResult?.fullText.toLowerCase().includes(searchTerm.toLowerCase()) || false;

      const newObjectMatches = analysisResult?.objects.filter(obj => {
        const objName = obj.name.toLowerCase();
        const searchTermLower = searchTerm.toLowerCase();
        
        if (/[가-힣]/.test(searchTermLower)) {
          const englishTerms = koreanToEnglish[searchTermLower] || [];
          return englishTerms.some(term => objName.includes(term));
        }
        
        const koreanTerms = englishToKorean[searchTermLower] || [];
        return objName.includes(searchTermLower) || koreanTerms.some(term => objName.includes(term));
      }) || [];

      // 결과가 있으면 박스 표시
      if (newMatches.length > 0 || newFullTextMatch || newObjectMatches.length > 0) {
        // 박스 표시 로직은 이미 구현되어 있으므로 추가 작업 불필요
      }
    }
  }, [searchTerm, ocrResult, analysisResult]);

  // 확대/축소 제스처 설정
  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = savedScale.value * e.scale;
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      // 최소/최대 스케일 제한
      if (scale.value < 1) {
        scale.value = withSpring(1);
        savedScale.value = 1;
      } else if (scale.value > 3) {
        scale.value = withSpring(3);
        savedScale.value = 3;
      }
    });

  // 이동 제스처 설정
  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      if (scale.value > 1) {
        offsetX.value = savedOffsetX.value + e.translationX;
        offsetY.value = savedOffsetY.value + e.translationY;
      }
    })
    .onEnd(() => {
      savedOffsetX.value = offsetX.value;
      savedOffsetY.value = offsetY.value;
    });

  // 더블 탭으로 확대/축소 리셋
  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onStart(() => {
      if (scale.value > 1) {
        scale.value = withSpring(1);
        savedScale.value = 1;
        offsetX.value = withSpring(0);
        offsetY.value = withSpring(0);
        savedOffsetX.value = 0;
        savedOffsetY.value = 0;
      } else {
        scale.value = withSpring(2);
        savedScale.value = 2;
      }
    });

  // 제스처 조합
  const composed = Gesture.Simultaneous(
    Gesture.Race(pinchGesture, panGesture),
    doubleTapGesture
  );

  // 애니메이션 스타일
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: offsetX.value },
      { translateY: offsetY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <TouchableWithoutFeedback onPress={stopPropagation}>
      <View style={styles.previewDisplayContainer}>
        {image.type === 'video' ? (
          <TouchableWithoutFeedback onPress={handleVideoPress}>
            <Video
              ref={videoRef}
              source={{ uri: image.uri }}
              style={styles.previewMedia}
              resizeMode={ResizeMode.CONTAIN}
              useNativeControls={false}
              isLooping
              shouldPlay={isPlaying}
              onPlaybackStatusUpdate={(status) => {
                if (status.isLoaded && status.didJustFinish) {
                  setIsPlaying(false);
                  videoRef.current?.setPositionAsync(0);
                }
              }}
            />
          </TouchableWithoutFeedback>
        ) : (
          <View style={{ width: '100%', height: '100%' }} onLayout={onContainerLayout}>
            <View style={{ flex: 1 }}>
              <GestureDetector gesture={composed}>
                <Animated.View style={[{ flex: 1 }, animatedStyle]}>
                  <Image
                    source={{ uri: image.uri }}
                    style={styles.previewMedia}
                    resizeMode="contain"
                    onLayout={onImageLayout}
                  />
                  {/* 검색 결과(매칭 OCR 및 물체) 네모 박스 오버레이 */}
                  {containerLayout && imageLayout && ((matches.length > 0 || fullTextMatch) || objectMatches.length > 0) && (
                    (() => {
                      const origWidth = imageNaturalSize?.width || imageLayout.width;
                      const origHeight = imageNaturalSize?.height || imageLayout.height;
                      const contained = getContainedImageLayout(
                        containerLayout.width,
                        containerLayout.height,
                        origWidth,
                        origHeight
                      );
                      return (
                        <Svg
                          style={{ 
                            position: 'absolute', 
                            left: contained.offsetX, 
                            top: contained.offsetY,
                            width: '100%',
                            height: '60%'
                          }}
                          width={contained.width}
                          height={contained.height}
                        >
                          {/* 전체 텍스트 검색 결과가 있으면 전체 이미지에 표시 */}
                          {fullTextMatch && matches.length === 0 && (
                            <>
                              <Rect
                                x={0}
                                y={0}
                                width={contained.width}
                                height={contained.height}
                                stroke="rgba(70, 250, 118, 0.8)"
                                strokeWidth={4}
                                strokeDasharray="10,5"
                                fill="rgba(70, 250, 118, 0.05)"
                                rx={8}
                                ry={8}
                              />
                              <SvgText
                                x={contained.width / 2}
                                y={20}
                                fontSize="16"
                                fontWeight="bold"
                                fill="rgba(70, 250, 118, 0.9)"
                                textAnchor="middle"
                              >
                                텍스트 발견됨
                              </SvgText>
                            </>
                          )}
                          
                          {/* 개별 텍스트 매칭 박스 */}
                          {matches.map((match, index) => {
                            const vertices = match.boundingPoly.vertices;
                            const minX = Math.min(...vertices.map(v => v.x));
                            const minY = Math.min(...vertices.map(v => v.y));
                            const maxX = Math.max(...vertices.map(v => v.x));
                            const maxY = Math.max(...vertices.map(v => v.y));
                            
                            const x = (minX / origWidth) * contained.width;
                            const y = (minY / origHeight) * contained.height;
                            const width = ((maxX - minX) / origWidth) * contained.width;
                            const height = ((maxY - minY) / origHeight) * contained.height;

                            return (
                              <React.Fragment key={`text-${index}`}>
                                <Rect
                                  x={x}
                                  y={y}
                                  width={width}
                                  height={height}
                                  stroke="#46B876"
                                  strokeWidth={2}
                                  fill="rgba(70, 184, 118, 0.1)"
                                  rx={2}
                                  ry={2}
                                />
                              </React.Fragment>
                            );
                          })}

                          {/* 물체 매칭 박스 */}
                          {objectMatches.map((obj, index) => {
                            const vertices = obj.boundingBox;
                            const minX = Math.min(...vertices.map(v => v.x));
                            const minY = Math.min(...vertices.map(v => v.y));
                            const maxX = Math.max(...vertices.map(v => v.x));
                            const maxY = Math.max(...vertices.map(v => v.y));
                            
                            const x = minX * contained.width;
                            const y = minY * contained.height;
                            const width = (maxX - minX) * contained.width;
                            const height = (maxY - minY) * contained.height;

                            return (
                              <React.Fragment key={`obj-${index}`}>
                                <Rect
                                  x={x}
                                  y={y}
                                  width={width}
                                  height={height}
                                  stroke="#4299E2"
                                  strokeWidth={2}
                                  fill="rgba(66, 153, 225, 0.1)"
                                  rx={2}
                                  ry={2}
                                />
                              </React.Fragment>
                            );
                          })}
                        </Svg>
                      );
                    })()
                  )}
                </Animated.View>
              </GestureDetector>
            </View>
            {isLoadingOcr && (
              <View style={styles.loadingOverlay}>
                <LoadingWave />
              </View>
            )}
          </View>
        )}
      </View>
    </TouchableWithoutFeedback>
  );
};

export default ImagePreview;
