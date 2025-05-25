import { GOOGLE_CLOUD_VISION_API_KEY, OPENAI_API_KEY } from '@env';
import { MaterialIcons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { BlurView } from 'expo-blur';
import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import type { ImagePickerAsset } from 'expo-image-picker';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useRef, useState } from 'react';

import {
  ActionSheetIOS,
  Alert,
  Animated,
  Appearance,
  Image,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import Markdown from 'react-native-markdown-display';
import type { OcrResult } from '../api/googleVisionApi';
import { ocrWithGoogleVision } from '../api/googleVisionApi';
import { getInfoFromTextWithOpenAI, suggestTasksFromOcr, TaskSuggestion } from '../api/openaiApi';
import {
  answerQuestionFromSpeech
} from '../api/openaiApiForSTT';
import { playAudio, speechToText, startRecording, stopRecording, textToSpeech } from '../api/speechApi';
import { extractTextFromVideo } from '../api/videoOcrApi';
import ImageTypeSelector from '../components/ImageTypeSelector';
import MediaPreviewModal from '../components/MediaPreviewModal';
import SummarizationSection from '../components/SummarizationSection';
import TaskSuggestionList from '../components/TaskSuggestionList';
import VideoPreview from '../components/VideoPreview';
import { ImageType } from '../constants/ImageTypes';
import { homeScreenStyles as styles } from '../styles/HomeScreen.styles';
import { detectImageType } from '../utils/imageTypeDetector';
import { translateToKorean } from '../utils/koreanTranslator';



interface SelectedImage {
  uri: string;
  width?: number;
  height?: number;
  assetId?: string;
  type?: 'image' | 'video'; 
}

interface OcrLoadingState {
  [uri: string]: boolean;
}

interface ImageTypeState {
  [uri: string]: ImageType;
}

interface AnalysisResult {
  text: string;
  objects: Array<{
    name: string;
    confidence: number;
    boundingBox: Array<{ x: number; y: number }>;
  }>;
  labels: Array<{
    description: string;
    confidence: number;
  }>;
  faces: Array<{
    joyLikelihood: string;
    sorrowLikelihood: string;
    angerLikelihood: string;
    surpriseLikelihood: string;
    underExposedLikelihood: string;
    blurredLikelihood: string;
    headwearLikelihood: string;
  }>;
  landmarks: Array<{
    description: string;
    score: number;
    locations: Array<{ x: number; y: number }>;
  }>;
  logos: Array<{
    description: string;
    score: number;
  }>;
  safeSearch: {
    adult: string;
    spoof: string;
    medical: string;
    violence: string;
    racy: string;
  };
  colors: Array<{
    color: { red: number; green: number; blue: number };
    score: number;
    pixelFraction: number;
  }>;
  webEntities: Array<{
    description: string;
    score: number;
  }>;
  similarImages: Array<{
    url: string;
    score: number;
  }>;
}

// 이미지별 task 제안을 관리하기 위한 인터페이스
interface ImageTaskSuggestions {
  [imageUri: string]: {
    suggestions: TaskSuggestion[];
    imageType: ImageType;
  }
}

const LoadingWave = () => {
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

  return (
    <View style={styles.loadingWaveContainer}>
      {animations.map((anim, index) => (
        <Animated.View
          key={index}
          style={[
            styles.loadingBar,
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
  );
};

const AnswerLoadingSkeleton = () => {
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
            duration: 1000,
            delay: index * 200,
            useNativeDriver: false,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 1000,
            useNativeDriver: false,
          }),
        ]);
      });

      Animated.stagger(200, sequences).start(() => animate());
    };

    animate();
  }, []);

  return (
    <View style={styles.answerLoadingContainer}>
      {animations.map((anim, index) => (
        <Animated.View
          key={index}
          style={[
            styles.answerLoadingBar,
            index === 0 && styles.answerLoadingBarLong,
            index === 1 && styles.answerLoadingBarMedium,
            index === 2 && styles.answerLoadingBarShort,
            index === 3 && styles.answerLoadingBarMedium,
            {
              opacity: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.3, 0.7],
              }),
            },
          ]}
        />
      ))}
    </View>
  );
};

const OcrLoadingAnimation = () => {
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

  return (
    <View style={styles.loadingOverlayThumb}>
      {animations.map((anim, index) => (
        <Animated.View
          key={index}
          style={[
            styles.loadingBar,
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
  );
};

// 마크다운 스타일 정의
const markdownStyles = {
  body: {
    color: '#000',
    fontSize: 16,
    lineHeight: 24,
  },
  heading1: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#000',
  },
  heading2: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 14,
    color: '#000',
  },
  heading3: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#000',
  },
  paragraph: {
    marginBottom: 12,
  },
  list_item: {
    marginBottom: 8,
  },
  bullet_list: {
    marginBottom: 12,
  },
  ordered_list: {
    marginBottom: 12,
  },
  code_inline: {
    backgroundColor: '#f0f0f0',
    padding: 4,
    borderRadius: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  code_block: {
    backgroundColor: '#f0f0f0',
    padding: 12,
    borderRadius: 4,
    marginBottom: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  blockquote: {
    borderLeftWidth: 4,
    borderLeftColor: '#ddd',
    paddingLeft: 12,
    marginBottom: 12,
    fontStyle: 'italic',
  },
  link: {
    color: '#4299E2',
    textDecorationLine: 'underline' as const,
  },
  strong: {
    fontWeight: 'bold',
  },
  em: {
    fontStyle: 'italic',
  },
} as const;

const HomeScreen = () => {
  const [colorScheme, setColorScheme] = useState(Appearance.getColorScheme());
  
  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setColorScheme(colorScheme);
    });

    return () => subscription.remove();
  }, []);

  const [selectedImages, setSelectedImages] = useState<ImagePickerAsset[]>([]);
  const [infoResult, setInfoResult] = useState<string | null>(null);
  const [ocrResults, setOcrResults] = useState<{[uri: string]: OcrResult | null}>({});
  const [isLoadingOcr, setIsLoadingOcr] = useState<OcrLoadingState>({});
  const [questionText, setQuestionText] = useState<string>('');
  const [previewMediaAsset, setPreviewMediaAsset] = useState<ImagePickerAsset | null>(null);
  const [isFetchingInfo, setIsFetchingInfo] = useState<boolean>(false);
  const [cameraPermissionStatus, setCameraPermissionStatus] = useState<ImagePicker.PermissionStatus | null>(null);
  const [assetUriMap, setAssetUriMap] = useState<{ [internalUri: string]: string | undefined }>({});
  const [imageTypes, setImageTypes] = useState<ImageTypeState>({});
  const [fadeAnim] = useState(new Animated.Value(0));
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedObject, setSelectedObject] = useState<number | null>(null);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [taskSuggestions, setTaskSuggestions] = useState<TaskSuggestion[]>([]);
  const [imageTaskSuggestions, setImageTaskSuggestions] = useState<ImageTaskSuggestions>({});
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);

  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessingSpeech, setIsProcessingSpeech] = useState(false);
  const [ttsAudioUri, setTtsAudioUri] = useState<string | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  // 음성 명령 처리 관련 상태 추가
  const recordingDuration = useRef<number>(0);
  const recordingStartTime = useRef<number>(0);

  // 디버깅을 위한 useEffect 추가
  useEffect(() => {
    console.log('Task suggestions updated:', taskSuggestions);
  }, [taskSuggestions]);

  const handleTypeChange = (uri: string, newType: ImageType) => {
    setImageTypes(prev => ({ ...prev, [uri]: newType }));
  };

  const processImageWithOCR = async (imageUri: string) => {
    setIsLoadingOcr(prev => ({ ...prev, [imageUri]: true }));
    try {
      const ocrResult = await ocrWithGoogleVision(imageUri);
      console.log('OCR Result:', {
        imageUri,
        ocrResult
      });

      if (ocrResult && ocrResult.textBoxes.length > 0) {
        setOcrResults(prevResults => ({ ...prevResults, [imageUri]: ocrResult }));
        const detectedType = detectImageType(ocrResult.fullText);
        setImageTypes(prev => ({ ...prev, [imageUri]: detectedType }));

        // OCR 결과로 task 제안 생성
        const suggestions = await suggestTasksFromOcr(ocrResult.fullText);
        if (suggestions && suggestions.length > 0) {
          // 각 이미지별로 task 제안 저장
          setImageTaskSuggestions(prev => ({
            ...prev,
            [imageUri]: {
              suggestions,
              imageType: detectedType
            }
          }));
        }
      } else {
        setOcrResults(prevResults => ({ ...prevResults, [imageUri]: null }));
        setImageTypes(prev => ({ ...prev, [imageUri]: 'OTHER' }));
      }
    } catch (error) {
      console.error(`이미지 OCR 오류 (${imageUri}):`, error);
      setOcrResults(prevResults => ({ ...prevResults, [imageUri]: null }));
      setImageTypes(prev => ({ ...prev, [imageUri]: 'OTHER' }));
    } finally {
      // 작업 제안이 완료된 후에 로딩 상태 해제
      setIsLoadingOcr(prev => ({ ...prev, [imageUri]: false }));
    }
  };

  const processVideoWithOCR = async (videoUri: string) => {
    setIsLoadingOcr(prev => ({ ...prev, [videoUri]: true }));
    try {
      const results = await extractTextFromVideo(videoUri, 1); // 1초당 1프레임
      console.log('Video OCR Results:', results);

      if (results.length > 0) {
        // 모든 프레임의 텍스트를 하나로 합침
        const combinedText = results
          .map(result => `[${result.time/1000}초] ${result.text}`)
          .join('\n\n');
        
        // OcrResult 형식에 맞게 변환
        const ocrResult: OcrResult = {
          fullText: combinedText,
          textBoxes: results.map(result => ({
            description: result.text,
            boundingPoly: {
              vertices: [
                { x: 0, y: 0 },
                { x: 0, y: 0 },
                { x: 0, y: 0 },
                { x: 0, y: 0 }
              ]
            }
          }))
        };

        setOcrResults(prevResults => ({ ...prevResults, [videoUri]: ocrResult }));
        const detectedType = detectImageType(combinedText);
        setImageTypes(prev => ({ ...prev, [videoUri]: detectedType }));

        // OCR 결과로 task 제안 생성
        const suggestions = await suggestTasksFromOcr(combinedText);
        if (suggestions && suggestions.length > 0) {
          setImageTaskSuggestions(prev => ({
            ...prev,
            [videoUri]: {
              suggestions,
              imageType: detectedType
            }
          }));
        }
      } else {
        setOcrResults(prevResults => ({ ...prevResults, [videoUri]: null }));
        setImageTypes(prev => ({ ...prev, [videoUri]: 'OTHER' }));
      }
    } catch (error) {
      console.error(`비디오 OCR 오류 (${videoUri}):`, error);
      setOcrResults(prevResults => ({ ...prevResults, [videoUri]: null }));
      setImageTypes(prev => ({ ...prev, [videoUri]: 'OTHER' }));
    } finally {
      // 작업 제안이 완료된 후에 로딩 상태 해제
      setIsLoadingOcr(prev => ({ ...prev, [videoUri]: false }));
    }
  };

  useEffect(() => {
    if (!OPENAI_API_KEY || !GOOGLE_CLOUD_VISION_API_KEY) {
      Alert.alert(
        'API 키 오류',
        'OpenAI 또는 Google Cloud Vision API 키가 설정되지 않았습니다. .env 파일을 확인해주세요.',
      );
    }
    (async () => {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      setCameraPermissionStatus(permission.status);
    })();
  }, []);

  const verifyCameraPermissions = async () => {
    if (cameraPermissionStatus === ImagePicker.PermissionStatus.UNDETERMINED) { 
      const permissionResponse = await ImagePicker.requestCameraPermissionsAsync();
      setCameraPermissionStatus(permissionResponse.status);
      return permissionResponse.granted;
    }
    if (cameraPermissionStatus === ImagePicker.PermissionStatus.DENIED) { 
      Alert.alert('권한 필요', '카메라 사용을 위해 권한을 허용해주세요.');
      return false;
    }
    return true; 
  };

  const showMediaOptions = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['취소', '사진 보관함', '사진 찍기', '파일 선택'],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            handleChooseMedia();
          } else if (buttonIndex === 2) {
            handleTakePhoto();
          } else if (buttonIndex === 3) {
            handleChooseDocument();
          }
        }
      );
    } else {
      // Android용 Alert 다이얼로그
      Alert.alert(
        '미디어 선택',
        '원하는 옵션을 선택하세요',
        [
          { text: '취소', style: 'cancel' },
          { text: '사진 보관함', onPress: () => handleChooseMedia() },
          { text: '사진 찍기', onPress: () => handleTakePhoto() },
          { text: '파일 선택', onPress: () => handleChooseDocument() },
        ],
        { cancelable: true }
      );
    }
  };

  const handleChooseMedia = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsMultipleSelection: true,
        quality: 1,
      });

      if (!result.canceled && result.assets) {
        // 정방향 변환 적용 (이미지에만)
        const manipulatedAssets = await Promise.all(result.assets.map(async asset => {
          if (asset.type === 'image' && asset.uri) {
            const manipulated = await ImageManipulator.manipulateAsync(
              asset.uri,
              [], // no-op, just strip EXIF
              { compress: 1, format: ImageManipulator.SaveFormat.JPEG }
            );
            return { ...asset, uri: manipulated.uri };
          }
          return asset;
        }));

        // 선택된 이미지들을 상태에 추가
        setSelectedImages(prevImages => [...prevImages, ...manipulatedAssets]);
        const newAssetUriMap = { ...assetUriMap };
        manipulatedAssets.forEach(asset => {
          newAssetUriMap[asset.uri] = asset.assetId ?? undefined;
        });
        setAssetUriMap(newAssetUriMap);

        // 각 미디어에 대해 OCR 처리 및 task 제안 생성
        for (const asset of manipulatedAssets) {
          if (asset.uri) {
            if (asset.type === 'video') {
              await processVideoWithOCR(asset.uri);
            } else {
              await processImageWithOCR(asset.uri);
            }
          }
        }
      }
    } catch (error) {
      console.error('미디어 선택 오류:', error);
      Alert.alert('오류', '미디어를 선택하는 중 오류가 발생했습니다.');
    }
  };

  const handleChooseDocument = async () => {
    try {
      // 문서 선택 기능은 Expo의 DocumentPicker를 사용해야 하지만,
      // 현재 프로젝트에 포함되어 있지 않아 알림으로 대체합니다.
      Alert.alert(
        '알림',
        '문서 선택 기능을 사용하려면 expo-document-picker 패키지를 설치해야 합니다.',
        [{ text: '확인', onPress: () => console.log('문서 선택 기능 필요') }]
      );
      
      // 실제 구현은 아래와 같이 할 수 있습니다:
      // import * as DocumentPicker from 'expo-document-picker';
      // const result = await DocumentPicker.getDocumentAsync({ type: '*/*' });
      // if (result.type === 'success') {
      //   // 선택된 문서 처리
      // }
    } catch (error) {
      console.error('문서 선택 오류:', error);
      Alert.alert('오류', '문서를 선택하는 중 오류가 발생했습니다.');
    }
  };

  const handleTakePhoto = async () => {
    const hasPermission = await verifyCameraPermissions();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 1,
      });

      if (!result.canceled && result.assets) {
        let newImage = result.assets[0];
        if (newImage.type === 'image' && newImage.uri) {
          const manipulated = await ImageManipulator.manipulateAsync(
            newImage.uri,
            [],
            { compress: 1, format: ImageManipulator.SaveFormat.JPEG }
          );
          newImage = { ...newImage, uri: manipulated.uri };
        }
        setSelectedImages(prevImages => [...prevImages, newImage]);
        const newAssetUriMap = { ...assetUriMap };
        newAssetUriMap[newImage.uri] = newImage.assetId ?? undefined;
        setAssetUriMap(newAssetUriMap);

        if (newImage.uri) {
          await processImageWithOCR(newImage.uri);
        }
      }
    } catch (error) {
      console.error('사진 촬영 오류:', error);
      Alert.alert('오류', '사진을 촬영하는 중 오류가 발생했습니다.');
    }
  };

  const handleGetInfo = async () => {
    if (selectedImages.length === 0) {
      Alert.alert('알림', '미디어를 먼저 선택해주세요.');
      return;
    }

    setIsFetchingInfo(true);
    setInfoResult(null);

    try {
      const selectedMedia = selectedImages[0];
      if (!selectedMedia.uri) {
        throw new Error('미디어 URI가 없습니다.');
      }

      let analysisText = '';

      if (selectedMedia.type === 'video') {
        try {
          // 비디오 프레임에서 텍스트 추출
          const results = await extractTextFromVideo(selectedMedia.uri, 1);
          
          if (results.length > 0) {
            analysisText += '[비디오 텍스트 분석 결과]\n';
            results.forEach(result => {
              analysisText += `[${result.time/1000}초] ${result.text}\n`;
            });
            analysisText += '\n';
          } else {
            analysisText += '[비디오에서 텍스트를 찾을 수 없습니다.]\n\n';
          }
        } catch (error) {
          console.error('비디오 분석 중 오류:', error);
          analysisText += '[비디오 분석 중 오류가 발생했습니다.]\n\n';
        }
      } else {
        // 이미지 분석 로직
        const analysisResult = await analyzeImage(selectedMedia.uri);
        if (!analysisResult) {
          throw new Error('이미지 분석에 실패했습니다.');
        }

        console.log('=== Image Analysis Started ===');
        console.log('Analysis Result:', analysisResult);

        // 물체 감지 결과를 기반으로 문서 유형 추정
        const detectedObjects = analysisResult.objects.map(obj => obj.name.toLowerCase());
        const detectedLabels = analysisResult.labels.map(label => label.description.toLowerCase());
        
        // 문서 유형 판별
        let documentType = '';
        if (detectedObjects.includes('receipt') || detectedLabels.includes('receipt')) {
          documentType = '영수증';
        } else if (detectedObjects.includes('id card') || detectedLabels.includes('id card')) {
          documentType = '신분증';
        } else if (detectedObjects.includes('business card') || detectedLabels.includes('business card')) {
          documentType = '명함';
        } else if (detectedObjects.includes('document') || detectedLabels.includes('document')) {
          documentType = '문서';
        }

        // 문서 유형이 감지된 경우
        if (documentType) {
          analysisText += `[문서 유형]\n${documentType}\n\n`;
          
          // 영수증인 경우 특별 처리
          if (documentType === '영수증') {
            const text = analysisResult.text;
            const totalAmountMatch = text.match(/총\s*[가-힣]*\s*금액\s*:?\s*(\d+[,\d]*원)/i) || 
                                   text.match(/합계\s*:?\s*(\d+[,\d]*원)/i) ||
                                   text.match(/total\s*:?\s*(\d+[,\d]*원)/i);
            
            if (totalAmountMatch) {
              analysisText += `[결제 금액]\n${totalAmountMatch[1]}\n\n`;
            }
          }
        }

        // 감지된 물체 정보
        if (analysisResult.objects.length > 0) {
          analysisText += '[감지된 물체]\n';
          for (const obj of analysisResult.objects) {
            const vertices = obj.boundingBox;
            const minX = Math.min(...vertices.map(v => v.x));
            const minY = Math.min(...vertices.map(v => v.y));
            const maxX = Math.max(...vertices.map(v => v.x));
            const maxY = Math.max(...vertices.map(v => v.y));
            
            // 위치 정보를 이미지 크기에 대한 상대적 비율로 표시
            const position = {
              left: Math.round(minX * 100),
              top: Math.round(minY * 100),
              right: Math.round(maxX * 100),
              bottom: Math.round(maxY * 100)
            };
            
            // 영어 단어를 한글로 번역
            const koreanTranslations = await translateToKorean(obj.name);
            const koreanText = koreanTranslations.length > 0 ? ` (${koreanTranslations.join(', ')})` : '';
            
            analysisText += `- ${obj.name}${koreanText} (신뢰도: ${(obj.confidence * 100).toFixed(1)}%)\n`;
            analysisText += `  위치: 왼쪽 ${position.left}%, 위 ${position.top}%, 오른쪽 ${position.right}%, 아래 ${position.bottom}%\n`;
          }
          analysisText += '\n';
        }

        // 텍스트 분석 결과
        if (analysisResult.text) {
          analysisText += `[텍스트 분석 결과]\n${analysisResult.text}\n\n`;
        }

        // 이미지 라벨
        if (analysisResult.labels.length > 0) {
          analysisText += '[이미지 라벨]\n';
          analysisResult.labels.forEach(label => {
            analysisText += `- ${label.description} (신뢰도: ${Math.round(label.confidence * 100)}%)\n`;
          });
          analysisText += '\n';
        }

        // 얼굴 감지 결과
        if (analysisResult.faces.length > 0) {
          analysisText += '[얼굴 감지 결과]\n';
          analysisResult.faces.forEach((face, index) => {
            analysisText += `얼굴 ${index + 1}:\n`;
            if (face.joyLikelihood !== 'UNLIKELY') analysisText += `- 기쁨: ${face.joyLikelihood}\n`;
            if (face.sorrowLikelihood !== 'UNLIKELY') analysisText += `- 슬픔: ${face.sorrowLikelihood}\n`;
            if (face.angerLikelihood !== 'UNLIKELY') analysisText += `- 분노: ${face.angerLikelihood}\n`;
            if (face.surpriseLikelihood !== 'UNLIKELY') analysisText += `- 놀람: ${face.surpriseLikelihood}\n`;
            if (face.headwearLikelihood !== 'UNLIKELY') analysisText += `- 모자 착용: ${face.headwearLikelihood}\n`;
          });
          analysisText += '\n';
        }

        // 랜드마크 감지 결과
        if (analysisResult.landmarks.length > 0) {
          analysisText += '[감지된 랜드마크]\n';
          analysisResult.landmarks.forEach(landmark => {
            analysisText += `- ${landmark.description} (신뢰도: ${Math.round(landmark.score * 100)}%)\n`;
          });
          analysisText += '\n';
        }

        // 로고 감지 결과
        if (analysisResult.logos.length > 0) {
          analysisText += '[감지된 로고]\n';
          analysisResult.logos.forEach(logo => {
            analysisText += `- ${logo.description} (신뢰도: ${Math.round(logo.score * 100)}%)\n`;
          });
          analysisText += '\n';
        }
      }

      if (questionText.trim()) {
        analysisText += `\n질문: ${questionText.trim()}`;
      }

      const information = await getInfoFromTextWithOpenAI(analysisText);
      setInfoResult(information);

      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: false,
      }).start();

    } catch (error) {
      console.error('Error processing media:', error);
      setInfoResult('미디어 처리 중 오류가 발생했습니다.');
    } finally {
      setIsFetchingInfo(false);
    }
  };

  const analyzeImage = async (imageUri: string): Promise<AnalysisResult | null> => {
    try {
      // 1. 이미지 크기 최적화 (API 호출 전에 미리 리사이즈)
      const optimizedImage = await ImageManipulator.manipulateAsync(
        imageUri,
        [
          // 이미지가 너무 크면 리사이즈 (Google Vision API 권장: 최대 20MB, 권장 1024x1024)
          { resize: { width: Math.min(1024, 2048) } }
        ],
        { 
          compress: 0.8, // 압축률 조정 (0.8 = 80% 품질)
          format: ImageManipulator.SaveFormat.JPEG 
        }
      );
  
      // 2. 이미지를 base64로 변환
      const base64Image = await FileSystem.readAsStringAsync(optimizedImage.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
  
      // 3. base64 크기 체크 (Google Vision API 제한: 20MB)
      const imageSizeInMB = (base64Image.length * 3) / 4 / (1024 * 1024); // base64 크기 계산
      console.log(`이미지 크기: ${imageSizeInMB.toFixed(2)}MB`);
      
      if (imageSizeInMB > 18) { // 18MB로 여유두기
        console.warn('이미지가 너무 큽니다. 추가 압축을 진행합니다.');
        const furtherCompressed = await ImageManipulator.manipulateAsync(
          optimizedImage.uri,
          [{ resize: { width: 512 } }],
          { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG }
        );
        
        const compressedBase64 = await FileSystem.readAsStringAsync(furtherCompressed.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        
        return await callGoogleVisionAPI(compressedBase64);
      }
  
      return await callGoogleVisionAPI(base64Image);
  
    } catch (error) {
      console.log('이미지 분석 중 오류 발생:', error);
      
      // AbortError 특별 처리
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('네트워크 타임아웃 발생. 재시도를 권장합니다.');
        return null;
      }
      
      return null;
    }
  };
  
  // Google Vision API 호출을 별도 함수로 분리
  const callGoogleVisionAPI = async (base64Image: string, retryCount: number = 0): Promise<AnalysisResult | null> => {
    const maxRetries = 2; // 최대 2번 재시도
    
    try {
      // Google Cloud Vision API 요청 본문 준비
      const requestBody = {
        requests: [
          {
            image: {
              content: base64Image,
            },
            features: [
              { type: 'TEXT_DETECTION' },
              { type: 'OBJECT_LOCALIZATION' },
              { type: 'FACE_DETECTION' },
              { type: 'LANDMARK_DETECTION' },
              { type: 'LOGO_DETECTION' },
              { type: 'SAFE_SEARCH_DETECTION' },
              { type: 'IMAGE_PROPERTIES' },
              { type: 'WEB_DETECTION' },
            ],
          },
        ],
      };
  
      // 타임아웃 설정 (60초로 증가)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.log(`API 호출 타임아웃 (시도 횟수: ${retryCount + 1})`);
        controller.abort();
      }, 60000); // 30초 -> 60초로 증가
  
      // Google Cloud Vision API 호출
      const response = await fetch(
        `https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_CLOUD_VISION_API_KEY}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        }
      );
  
      clearTimeout(timeoutId);
  
      if (!response.ok) {
        console.log('Google Vision API 응답 오류:', response.status);
        
        // 429 (Rate Limit) 또는 503 (Service Unavailable) 에러인 경우 재시도
        if ((response.status === 429 || response.status === 503) && retryCount < maxRetries) {
          console.log(`API 에러 ${response.status}. ${retryCount + 1}초 후 재시도...`);
          await new Promise(resolve => setTimeout(resolve, (retryCount + 1) * 1000));
          return callGoogleVisionAPI(base64Image, retryCount + 1);
        }
        
        return null;
      }
  
      const data = await response.json();
      const result = data.responses[0];
  
      // 결과 처리
      const analysisResult: AnalysisResult = {
        text: result.textAnnotations?.[0]?.description || '',
        objects: result.localizedObjectAnnotations?.map((obj: any) => ({
          name: obj.name,
          confidence: obj.score,
          boundingBox: obj.boundingPoly.normalizedVertices,
        })) || [],
        labels: result.labelAnnotations?.map((label: any) => ({
          description: label.description,
          confidence: label.score,
        })) || [],
        faces: result.faceAnnotations?.map((face: any) => ({
          joyLikelihood: face.joyLikelihood,
          sorrowLikelihood: face.sorrowLikelihood,
          angerLikelihood: face.angerLikelihood,
          surpriseLikelihood: face.surpriseLikelihood,
          boundingBox: face.boundingPoly.vertices,
        })) || [],
        landmarks: result.landmarkAnnotations?.map((landmark: any) => ({
          description: landmark.description,
          confidence: landmark.score,
          boundingBox: landmark.boundingPoly.vertices,
        })) || [],
        logos: result.logoAnnotations?.map((logo: any) => ({
          description: logo.description,
          confidence: logo.score,
          boundingBox: logo.boundingPoly.vertices,
        })) || [],
        safeSearch: result.safeSearchAnnotation || null,
        colors: result.imagePropertiesAnnotation?.dominantColors?.colors?.map((color: any) => ({
          color: color.color,
          score: color.score,
          pixelFraction: color.pixelFraction,
        })) || [],
        webEntities: result.webDetection?.webEntities?.map((entity: any) => ({
          description: entity.description,
          score: entity.score,
        })) || [],
        similarImages: result.webDetection?.visuallySimilarImages?.map((image: any) => ({
          url: image.url,
        })) || [],
      };
  
      return analysisResult;
  
    } catch (error) {
      console.log(`API 호출 중 에러 (시도 횟수: ${retryCount + 1}):`, error);
      
      // AbortError인 경우 재시도
      if (error instanceof Error && error.name === 'AbortError' && retryCount < maxRetries) {
        console.log(`타임아웃 발생. ${retryCount + 1}초 후 재시도...`);
        await new Promise(resolve => setTimeout(resolve, (retryCount + 1) * 1000));
        return callGoogleVisionAPI(base64Image, retryCount + 1);
      }
      
      return null;
    }
  };

  const handleMediaPreview = async (media: ImagePickerAsset) => {
    setPreviewMediaAsset(media);
    if (media.type === 'image') {
      try {
        const result = await analyzeImage(media.uri);
        setAnalysisResult(result);
      } catch (error) {
        console.error('Error analyzing image:', error);
      }
    }
  };

  // 이미지 삭제 시 관련 상태들도 함께 정리
  const removeImage = (uri: string) => {
    // 선택된 이미지 목록에서 제거
    setSelectedImages(prevImages => prevImages.filter(img => img.uri !== uri));
    // OCR 결과에서 제거
    setOcrResults(prevResults => {
      const newResults = { ...prevResults };
      delete newResults[uri];
      return newResults;
    });
    // 이미지 타입 정보에서 제거
    setImageTypes(prev => {
      const newTypes = { ...prev };
      delete newTypes[uri];
      return newTypes;
    });
    
    // task 제안에서도 해당 이미지 제거
    setImageTaskSuggestions(prev => {
      const newSuggestions = { ...prev };
      delete newSuggestions[uri];
      return newSuggestions;
    });

    // 삭제된 이미지가 현재 선택된 이미지였다면 다른 이미지 선택
    if (uri === selectedImageUri) {
      const remainingUris = Object.keys(imageTaskSuggestions).filter(key => key !== uri);
      setSelectedImageUri(remainingUris[0] || null);
    }
  };

  const openPreview = (mediaAsset: ImagePickerAsset) => {
    setPreviewMediaAsset(mediaAsset);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: false,
    }).start();
  };

  const closePreview = () => {
    setPreviewMediaAsset(null);
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: false,
    }).start();
  };
  // 음성 질문으로 정보 가져오기
  const handleGetInfoFromSpeech = async (question: string) => {
    if (!question.trim()) {
      return;
    }
  
    setQuestionText(question); // 질문 텍스트 상태 업데이트
    setIsFetchingInfo(true);
    setInfoResult(null);
  
    try {
      const selectedMedia = previewMediaAsset;
      if (!selectedMedia || !selectedMedia.uri) {
        throw new Error('미디어 URI가 없습니다.');
      }
  
      let analysisText = '';
  
      // 오디오/비디오인 경우
      if (selectedMedia.type === 'video') {
        try {
          const results = await extractTextFromVideo(selectedMedia.uri, 1);
          
          if (results.length > 0) {
            analysisText += '[비디오 텍스트 분석 결과]\n';
            results.forEach(result => {
              analysisText += `[${result.time/1000}초] ${result.text}\n`;
            });
            analysisText += '\n';
          } else {
            analysisText += '[비디오에서 텍스트를 찾을 수 없습니다.]\n\n';
          }
        } catch (error) {
          console.error('비디오 분석 중 오류:', error);
          analysisText += '[비디오 분석 중 오류가 발생했습니다.]\n\n';
        }
      } else {
        // 이미지 분석 로직은 기존과 동일
        const analysisResult = await analyzeImage(selectedMedia.uri);
        if (!analysisResult) {
          throw new Error('이미지 분석에 실패했습니다.');
        }
  
        console.log('=== Image Analysis Started (Voice Query) ===');
        console.log('Analysis Result:', analysisResult);
  
        // 물체 감지 결과를 기반으로 문서 유형 추정
        const detectedObjects = analysisResult.objects.map(obj => obj.name.toLowerCase());
        const detectedLabels = analysisResult.labels.map(label => label.description.toLowerCase());
        
        // 문서 유형 판별
        let documentType = '';
        if (detectedObjects.includes('receipt') || detectedLabels.includes('receipt')) {
          documentType = '영수증';
        } else if (detectedObjects.includes('id card') || detectedLabels.includes('id card')) {
          documentType = '신분증';
        } else if (detectedObjects.includes('business card') || detectedLabels.includes('business card')) {
          documentType = '명함';
        } else if (detectedObjects.includes('document') || detectedLabels.includes('document')) {
          documentType = '문서';
        }
  
        // 문서 유형이 감지된 경우
        if (documentType) {
          analysisText += `[문서 유형]\n${documentType}\n\n`;
        }
  
        // 텍스트 분석 결과
        if (analysisResult.text) {
          analysisText += `[텍스트 분석 결과]\n${analysisResult.text}\n\n`;
        }
  
        // 이미지 라벨
        if (analysisResult.labels.length > 0) {
          analysisText += '[이미지 라벨]\n';
          analysisResult.labels.forEach(label => {
            analysisText += `- ${label.description} (신뢰도: ${Math.round(label.confidence * 100)}%)\n`;
          });
          analysisText += '\n';
        }
      }
  
      // 음성으로 받은 질문 추가
      analysisText += `\n질문: ${question.trim()}`;
  
      const information = await getInfoFromTextWithOpenAI(analysisText);
      setInfoResult(information);
  
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: false,
      }).start();
  
    } catch (error) {
      console.error('Error processing media with speech:', error);
      setInfoResult('음성 질문 처리 중 오류가 발생했습니다.');
    } finally {
      setIsFetchingInfo(false);
      // 모달 닫기
      closePreview();
    }
  };

  // 음성 녹음 시작
const handleStartRecording = async () => {
    try {
      // 녹음 시작 시간 기록
      recordingStartTime.current = Date.now();
      
      setIsRecording(true);
      const newRecording = await startRecording();
      setRecording(newRecording);
      
      console.log('녹음 시작됨');
      return true; // 녹음 시작 성공
    } catch (error) {
      console.error('녹음 시작 오류:', error);
      setIsRecording(false);
      return false; // 녹음 시작 실패
    }
  };

// 음성 녹음 중지 및 처리
const handleStopRecording = async () => {
  try {
    if (!recording) {
      console.log('녹음 객체가 없습니다');
      setIsRecording(false);
      return false;
    }
    
    // 녹음 시간 계산
    recordingDuration.current = Date.now() - recordingStartTime.current;
    console.log(`녹음 시간: ${recordingDuration.current}ms`);
    
    // 너무 짧은 녹음인 경우 처리 중단 (300ms 미만)
    if (recordingDuration.current < 300) {
      console.log('녹음이 너무 짧습니다. 처리 중단');
      
      try {
        // 녹음 중지는 시도하되 결과는 무시
        await recording.stopAndUnloadAsync();
      } catch (stopError) {
        console.error('짧은 녹음 중지 중 오류:', stopError);
      }
      
      setRecording(null);
      setIsRecording(false);
      return false;
    }
    
    setIsRecording(false);
    setIsProcessingSpeech(true);
    
    // 녹음 중지
    const audioUri = await stopRecording(recording);
    setRecording(null);
    
    // STT 처리
    const transcribedText = await speechToText(audioUri);
    
    if (transcribedText && transcribedText.trim() && transcribedText !== '인식된 텍스트가 없습니다.') {
      console.log('변환된 텍스트:', transcribedText);
      
      // 중요: 미디어 프리뷰 모달이 열려있지 않을 때만 질문 텍스트 설정
      if (!previewMediaAsset) {
        setQuestionText(transcribedText);
      }
      
      // 현재 선택된 이미지를 기반으로 처리
      if (previewMediaAsset && previewMediaAsset.uri) {
        const currentOcrResult = ocrResults[previewMediaAsset.uri];
        
        if (currentOcrResult) {
          try {
            // OpenAI API 호출을 위한 분석 텍스트 준비
            let analysisText = currentOcrResult.fullText || '';
            
            // 물체 인식 결과 추가
            if (analysisResult && analysisResult.objects && analysisResult.objects.length > 0) {
              analysisText += '\n\n[감지된 물체]\n';
              analysisResult.objects.forEach(obj => {
                analysisText += `- ${obj.name} (신뢰도: ${Math.round(obj.confidence * 100)}%)\n`;
              });
            }
            
            // 음성으로 받은 질문 추가
            analysisText += `\n\n질문: ${transcribedText.trim()}`;
            
            // OpenAI API For STT 호출
            const aiResponse = await answerQuestionFromSpeech(
              transcribedText.trim(),
              currentOcrResult.fullText,
              analysisResult
            );
            console.log('AI 응답 받음');
            
            // 응답 저장 (필요시 UI 표시용)
            setInfoResult(aiResponse);
            
            // TTS 처리 및 음성 재생
            const ttsUri = await textToSpeech(aiResponse);
            if (ttsUri) {
              await playAudio(ttsUri);
            }
            
            return true; // 처리 성공
          } catch (aiError) {
            console.error('AI 처리 중 오류:', aiError);
          }
        }
      }
    } else {
      console.log('음성 인식 실패 또는 텍스트 없음');
    }
    
    return false; // 처리 실패 또는 텍스트 없음
  } catch (error) {
    console.error('녹음 중지 처리 중 오류:', error);
    return false; // 처리 실패
  } finally {
    // 항상 처리 상태 초기화
    setIsProcessingSpeech(false);
  }
};

// 음성 인식 실패 시 상태 초기화를 위한 함수
const handleSpeechRecognitionFailed = () => {
  setIsProcessingSpeech(false);
  setIsRecording(false);
  if (recording) {
    try {
      recording.stopAndUnloadAsync().then(() => {
        setRecording(null);
      });
    } catch (error) {
      console.error('녹음 객체 정리 중 오류:', error);
      setRecording(null);
    }
  }
  console.log('음성 인식 실패, 상태 초기화됨');
};

// TTS로 응답 재생
const handlePlayResponse = async (responseText: string) => {
  try {
    setIsPlayingAudio(true);
    
    // TTS 변환
    const audioUri = await textToSpeech(responseText);
    
    if (audioUri) {
      setTtsAudioUri(audioUri);
      
      // 오디오 재생
      await playAudio(audioUri);
    }
    
    setIsPlayingAudio(false);
  } catch (error) {
    console.error('TTS 재생 오류:', error);
    setIsPlayingAudio(false);
  }
};

  // Task 선택 시 해당 이미지의 정보를 기반으로 처리
  const handleTaskSelect = async (task: TaskSuggestion) => {
    setQuestionText(task.task);
    setInfoResult(null);
    setIsFetchingInfo(true);

    try {
      // 현재 선택된 이미지 찾기
      const selectedMedia = selectedImages.find(img => img.uri === selectedImageUri);
      if (!selectedMedia?.uri) {
        throw new Error('미디어 URI가 없습니다.');
      }

      let analysisText = '';

      // 비디오인 경우 비디오 분석 결과 사용
      if (selectedMedia.type === 'video') {
        try {
          const results = await extractTextFromVideo(selectedMedia.uri, 1);
          if (results.length > 0) {
            analysisText = results.map(result => result.text).join('\n');
          }
        } catch (error) {
          console.error('비디오 분석 중 오류:', error);
        }
      } else {
        // 이미지인 경우 이미지 분석 결과 사용
        const analysisResult = await analyzeImage(selectedMedia.uri);
        if (analysisResult && analysisResult.text) {
          analysisText = analysisResult.text;
        }
      }

      // 선택된 task와 분석 결과를 기반으로 정보 검색
      const information = await getInfoFromTextWithOpenAI(`${analysisText}\n\n질문: ${task.task}`);
      setInfoResult(information);

      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: false,
      }).start();

    } catch (error) {
      console.error('Error processing task:', error);
      setInfoResult('작업 처리 중 오류가 발생했습니다.');
    } finally {
      setIsFetchingInfo(false);
      closePreview();
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      keyboardShouldPersistTaps="handled"
    >
      <BlurView intensity={20} style={styles.header}>
        <View style={styles.headerTextContainer}>
          <Text style={styles.title}>Findit!</Text>
          <Text style={styles.subtitle}>
            미디어에서{'\n'}
            정보를{'\n'}
            찾아보세요<Text style={{ color: '#46B876' }}>.</Text>{'\n'}
          </Text>
        </View>
      </BlurView>

      <View style={styles.summarySection}>
        <SummarizationSection
          questionText={questionText}
          setQuestionText={setQuestionText}
        />
        
        {selectedImages.length > 0 && (
          <View style={styles.imagesSection}>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.imagesScrollContainer}
            >
              {selectedImages.map((media) => (
                <View key={media.assetId || media.uri} style={styles.imageWrapper}>
                  {media.type === 'video' ? (
                    <VideoPreview
                      videoUri={media.uri}
                      onPress={() => handleMediaPreview(media)}
                    />
                  ) : (
                    <TouchableOpacity
                      onPress={() => setSelectedImageUri(media.uri)}
                      style={[
                        styles.imageTouchable,
                        selectedImageUri === media.uri && styles.selectedImageBorder
                      ]}
                    >
                      {isLoadingOcr[media.uri] || isAnalyzing ? (
                        <BlurView intensity={90} style={styles.imageThumbnail}>
                          <Image 
                            source={{ uri: media.uri }} 
                            style={styles.imageThumbnail}
                            resizeMode="cover"
                          />
                        </BlurView>
                      ) : (
                        <Image 
                          source={{ uri: media.uri }} 
                          style={styles.imageThumbnail}
                          resizeMode="cover"
                        />
                      )}
                      {(isLoadingOcr[media.uri] || isAnalyzing) && (
                        <OcrLoadingAnimation />
                      )}
                    </TouchableOpacity>
                  )}
                  <View style={styles.imageButtonsContainer}>
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => removeImage(media.uri)}
                    >
                      <MaterialIcons name="close" size={20} color="#fff" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.magnifyButton}
                      onPress={() => handleMediaPreview(media)}
                    >
                      <MaterialIcons name="search" size={20} color="#fff" />
                    </TouchableOpacity>
                  </View>
                  <View style={{ marginTop: 12 }}>
                    <ImageTypeSelector 
                      uri={media.uri} 
                      currentType={imageTypes[media.uri] || 'OTHER'} 
                      onTypeChange={handleTypeChange} 
                    />
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        )}
        
        {selectedImages.length === 0 && (
          <TouchableOpacity
            style={styles.imageUploadButton}
            onPress={showMediaOptions}
          >
            <MaterialIcons name="add" size={48} color="#8e8e8e" />
            <Text style={styles.imageUploadButtonText}>미디어 업로드</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity 
          style={[
            styles.getInfoButton, 
            !questionText.trim() && styles.getInfoButtonDisabled
          ]} 
          onPress={handleGetInfo}
          disabled={!questionText.trim() || isFetchingInfo}
        >
          {isFetchingInfo ? (
            <LoadingWave />
          ) : (
            <Text style={[
              styles.getInfoButtonText,
              !questionText.trim() && styles.getInfoButtonTextDisabled
            ]}>
              이미지 정보 가져오기
            </Text>
          )}
        </TouchableOpacity>

        {/* Task Suggestions Section - Only show when an image is selected and suggestions exist */}
        {selectedImageUri && imageTaskSuggestions[selectedImageUri] && (
          <View style={styles.taskSuggestionsContainer}>
            <TaskSuggestionList
              suggestions={imageTaskSuggestions[selectedImageUri].suggestions}
              onTaskSelect={handleTaskSelect}
            />
          </View>
        )}

        {/* Answer Display */}
        {isFetchingInfo ? (
          <AnswerLoadingSkeleton />
        ) : infoResult && (
          <View>
            <Text style={styles.infoContainerTitle}>이미지 분석 결과</Text>
            <View style={styles.infoResultContainer}>
              <ScrollView style={styles.infoResultScrollView}>
                <Markdown style={markdownStyles}>
                  {infoResult}
                </Markdown>
              </ScrollView>
            </View>
          </View>
        )}
      </View>

      <MediaPreviewModal
        visible={!!previewMediaAsset}
        onClose={closePreview}
        mediaAsset={previewMediaAsset}
        ocrResult={ocrResults[previewMediaAsset?.uri || '']}
        isLoadingOcr={isLoadingOcr[previewMediaAsset?.uri || '']}
        colorScheme={colorScheme === 'dark' ? 'dark' : 'light'}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        analysisResult={analysisResult}

      >
  <Text>이미지 유형: {imageTypes[previewMediaAsset?.uri || ''] || '기타'}</Text>
</MediaPreviewModal>
    </ScrollView>
  );
};

export default HomeScreen;
