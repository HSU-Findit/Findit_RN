import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { TaskSuggestion } from '../api/openaiApi';

interface TaskSuggestionListProps {
  suggestions: TaskSuggestion[];
  onTaskSelect: (task: TaskSuggestion) => void;
}

const TaskSuggestionList: React.FC<TaskSuggestionListProps> = ({
  suggestions,
  onTaskSelect,
}) => {
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case '중요':
        return '#FF4444';
      case '보통':
        return '#FFBB33';
      case '낮음':
        return '#00C851';
      default:
        return '#757575';
    }
  };

  return (
    <View style={styles.container}>
      {suggestions.map((suggestion, index) => (
        <TouchableOpacity
          key={index}
          style={styles.taskButton}
          onPress={() => onTaskSelect(suggestion)}
        >
          <View style={styles.taskContent}>
            <Text style={styles.taskButtonText}>{suggestion.task}</Text>
            <View style={[
              styles.priorityBadge,
              { backgroundColor: getPriorityColor(suggestion.priority) }
            ]}>
              <Text style={styles.priorityText}>{suggestion.priority}</Text>
            </View>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'column',
    gap: 8,
  },
  taskButton: {
    backgroundColor: '#4299E2',
    borderRadius: 16,
    padding: 12,
  },
  taskContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  taskButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  priorityText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
  },
});

export default TaskSuggestionList; 