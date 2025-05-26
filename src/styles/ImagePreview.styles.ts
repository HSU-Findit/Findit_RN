import { StyleSheet } from 'react-native';

export const imagePreviewStyles = StyleSheet.create({
  previewDisplayContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  previewMedia: {
    width: '100%',
    height: '60%',
    // borderRadius: 12,
  },
  ocrTextScrollView: {
    maxHeight: 100,
    width: '100%',
    marginTop: 5,
    padding: 5,
    backgroundColor: '#f0f0f0',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  ocrText: {
    fontSize: 12,
  },
  highlightCircle: {
    position: 'absolute',
    borderWidth: 3,
    borderColor: 'red',
    borderStyle: 'solid',
    pointerEvents: 'none',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  }
}); 