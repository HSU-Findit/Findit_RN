import { GOOGLE_CLOUD_VISION_API_KEY } from '@env';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';

// STT(Speech-to-Text) API 호출
export const speechToText = async (audioUri: string): Promise<string | null> => {
  try {
    console.log('STT 처리 시작:', audioUri);
    
    // 오디오 파일 정보 확인
    const fileInfo = await FileSystem.getInfoAsync(audioUri);
    if (!fileInfo.exists) {
      console.error('오디오 파일이 존재하지 않습니다:', audioUri);
      return null;
    }
    console.log('오디오 파일 정보:', fileInfo);
    
    // 오디오 파일을 base64로 인코딩
    const audioBase64 = await FileSystem.readAsStringAsync(audioUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    console.log('Base64 인코딩 완료, 길이:', audioBase64.length);

    // Google Cloud Speech-to-Text API 호출
    console.log('Google Cloud Speech API 호출 시작');
    const response = await fetch(
      `https://speech.googleapis.com/v1/speech:recognize?key=${GOOGLE_CLOUD_VISION_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          config: {
            encoding: 'MP3', // Expo의 HIGH_QUALITY 프리셋과 호환되는 인코딩
            sampleRateHertz: 44100,
            languageCode: 'ko-KR',
            model: 'default',
            audioChannelCount: 2,
            enableAutomaticPunctuation: true,
            useEnhanced: true, // 향상된 모델 사용
          },
          audio: {
            content: audioBase64,
          },
        }),
      }
    );

    // API 응답 처리
    const responseText = await response.text();
    console.log('API 응답 받음, 상태:', response.status);
    
    if (!response.ok) {
      console.error('Google Cloud Speech API 오류:', responseText);
      return null;
    }

    // JSON 파싱
    const data = JSON.parse(responseText);
    console.log('API 응답 데이터:', JSON.stringify(data, null, 2));
    
    // 결과 처리
    if (
      data.results &&
      data.results.length > 0 &&
      data.results[0].alternatives &&
      data.results[0].alternatives.length > 0
    ) {
      const transcript = data.results[0].alternatives[0].transcript;
      return transcript;
    } else {
      console.warn('인식된 텍스트가 없습니다.');
      return '인식된 텍스트가 없습니다.'; // 사용자에게 피드백을 제공하기 위한 메시지
    }
  } catch (error) {
    console.error('Speech-to-Text 처리 중 오류:', error);
    return null;
  }
};

/**
 * 마크다운 특수 문자 및 서식을 제거하고 순수 텍스트만 추출하는 함수
 * @param markdownText 마크다운 형식의 텍스트
 * @returns 정제된 순수 텍스트
 */
export const cleanMarkdownForSpeech = (markdownText: string): string => {
  if (!markdownText) return '';
  
  let cleanText = markdownText;
  
  // 헤더(#) 제거
  cleanText = cleanText.replace(/^#+\s+/gm, '');
  
  // 강조(**/__, */_) 제거
  cleanText = cleanText.replace(/(\*\*|__)(.*?)\1/g, '$2');
  cleanText = cleanText.replace(/(\*|_)(.*?)\1/g, '$2');
  
  // 인라인 코드(``) 제거
  cleanText = cleanText.replace(/`([^`]+)`/g, '$1');
  
  // 링크([text](url)) 제거 - 텍스트만 남김
  cleanText = cleanText.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  
  // 이미지(![alt](url)) 제거
  cleanText = cleanText.replace(/!\[([^\]]*)\]\([^)]+\)/g, '');
  
  // 리스트 마커(-, *, +, 1.) 제거
  cleanText = cleanText.replace(/^[\s]*[-*+]\s+/gm, '');
  cleanText = cleanText.replace(/^[\s]*\d+\.\s+/gm, '');
  
  // 블록인용(>) 제거
  cleanText = cleanText.replace(/^>\s+/gm, '');
  
  // 코드 블록(```) 제거
  cleanText = cleanText.replace(/```[\s\S]*?```/g, '');
  
  // HTML 태그 제거
  cleanText = cleanText.replace(/<[^>]*>/g, '');
  
  // 여러 줄바꿈을 하나로 정리
  cleanText = cleanText.replace(/\n{3,}/g, '\n\n');
  
  // 앞뒤 공백 제거
  cleanText = cleanText.trim();
  
  // 추가: 괄호 내용을 그대로 유지 (괄호만 제거)
  cleanText = cleanText.replace(/\(([^)]*)\)/g, '$1');
  cleanText = cleanText.replace(/\[([^\]]*)\]/g, '$1');
  
  return cleanText;
};

// TTS(Text-to-Speech) API 호출
export const textToSpeech = async (text: string): Promise<string | null> => {
  try {
    // 마크다운 특수 문자를 제거하고 순수 텍스트만 추출
    const cleanedText = cleanMarkdownForSpeech(text);
    console.log('정제된 텍스트:', cleanedText);
    
    // Google Cloud Text-to-Speech API 호출
    const response = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${GOOGLE_CLOUD_VISION_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: { text: cleanedText },
          voice: {
            languageCode: 'ko-KR',
            name: 'ko-KR-Wavenet-A', // 한국어 웨이브넷 음성
            ssmlGender: 'FEMALE',
          },
          audioConfig: {
            audioEncoding: 'MP3',
            speakingRate: 1.0,
            pitch: 0,
            volumeGainDb: 0,
            effectsProfileId: ['small-bluetooth-speaker-class-device'],
          },
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Google Cloud Text-to-Speech API Error:', errorData);
      return null;
    }

    const data = await response.json();
    
    // 음성 파일 저장
    if (data.audioContent) {
      const audioPath = `${FileSystem.cacheDirectory}tts_output.mp3`;
      await FileSystem.writeAsStringAsync(audioPath, data.audioContent, {
        encoding: FileSystem.EncodingType.Base64,
      });
      console.log('TTS 오디오 파일 저장 완료:', audioPath);
      return audioPath;
    }

    return null;
  } catch (error) {
    console.error('Text-to-Speech 처리 중 오류:', error);
    return null;
  }
};

// 오디오 모드 설정 - 녹음 모드
export const setAudioModeForRecording = async (): Promise<void> => {
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,          // iOS에서 녹음 허용
      playsInSilentModeIOS: true,        // 무음 모드에서도 재생
      staysActiveInBackground: false,    // 백그라운드에서 비활성화
      // 인터럽션 모드 상수 제거
      shouldDuckAndroid: false,          // 다른 앱 오디오 볼륨 낮추지 않음
    });
    console.log('녹음 모드로 오디오 설정 완료');
  } catch (error) {
    console.error('오디오 모드 설정 중 오류:', error);
  }
};

// 오디오 모드 설정 - 재생 모드
export const setAudioModeForPlayback = async (): Promise<void> => {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,         // iOS에서 녹음 비허용
        playsInSilentModeIOS: true,        // 무음 모드에서도 재생
        staysActiveInBackground: false,    // 백그라운드에서 비활성화
        shouldDuckAndroid: false,          // 다른 앱 오디오 볼륨 낮추지 않음
        playThroughEarpieceAndroid: false  // Android에서 이어피스가 아닌 스피커 사용 (핵심 설정)
      });
      console.log('재생 모드로 오디오 설정 완료 (하단 스피커 사용)');
    } catch (error) {
      console.error('오디오 모드 설정 중 오류:', error);
    }
  };

// 음성 녹음 시작
export const startRecording = async (): Promise<Audio.Recording> => {
  try {
    console.log('녹음 시작 준비');
    
    // 오디오 권한 요청
    const { granted } = await Audio.requestPermissionsAsync();
    if (!granted) {
      throw new Error('오디오 녹음 권한이 필요합니다.');
    }
    
    // 녹음 모드로 오디오 설정
    await setAudioModeForRecording();

    // 녹음 설정 - Expo의 PRESET 사용
    const recording = new Audio.Recording();
    await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);

    // 녹음 시작
    await recording.startAsync();
    console.log('녹음 시작됨');
    return recording;
  } catch (error) {
    console.error('녹음 시작 중 오류:', error);
    throw error;
  }
};

// 음성 녹음 중지
export const stopRecording = async (recording: Audio.Recording): Promise<string> => {
  try {
    console.log('녹음 중지 시작');
    
    // 녹음 상태 확인
    const status = await recording.getStatusAsync();
    console.log('녹음 상태:', status);
    
    // 녹음 중지
    await recording.stopAndUnloadAsync();
    console.log('녹음 중지 완료');
    
    // 재생 모드로 오디오 설정 변경
    await setAudioModeForPlayback();
    
    // 녹음된 URI 반환
    const uri = recording.getURI() || '';
    console.log('녹음 파일 URI:', uri);
    
    // 파일 정보 확인
    if (uri) {
      const fileInfo = await FileSystem.getInfoAsync(uri);
      console.log('녹음된 파일 정보:', fileInfo);
    }
    
    return uri;
  } catch (error) {
    console.error('녹음 중지 중 오류:', error);
    throw error;
  }
};

// 오디오 재생
export const playAudio = async (audioUri: string): Promise<void> => {
    try {
      console.log('오디오 재생 시작:', audioUri);
      
      // 재생 모드로 오디오 설정 (하단 스피커 사용)
      await setAudioModeForPlayback();
      
      // 오디오 로드 및 재생
      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUri },
        { shouldPlay: true, volume: 1.0 }
      );
      
      // 재생 상태 모니터링 - any 타입 사용하여 타입 오류 해결
      sound.setOnPlaybackStatusUpdate((status: any) => {
        if (status.isLoaded) {
          if (status.didJustFinish) {
            console.log('오디오 재생 완료');
            sound.unloadAsync();
          } else {
            // 재생 중인 위치 (밀리초)
            const positionMillis = status.positionMillis;
            const durationMillis = status.durationMillis;
            if (durationMillis) {
              const progress = positionMillis / durationMillis;
              console.log(`재생 진행률: ${Math.round(progress * 100)}%`);
            }
          }
        } else if (status.error) {
          console.error('오디오 재생 오류:', status.error);
        }
      });
      
      // 재생 완료 시 리소스 해제
      await new Promise<void>((resolve) => {
        sound.setOnPlaybackStatusUpdate((status: any) => {
          if (status.isLoaded && status.didJustFinish) {
            sound.unloadAsync().then(() => resolve());
          }
        });
      });
      
    } catch (error) {
      console.error('오디오 재생 중 오류:', error);
    }
  };