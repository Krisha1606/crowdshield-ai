import React, { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, Image, Platform } from 'react-native';
import { useThemeColors } from '../hooks/useThemeColors';
import { GlassCard } from '../components/GlassCard';
import { ActionButton } from '../components/ActionButton';
import { useVolunteerStore } from '../store/useVolunteerStore';
import api from '../services/api';
import * as ImagePicker from 'expo-image-picker';

const INCIDENT_TYPES = [
  'Medical Emergency',
  'Lost Child',
  'Fight',
  'Fire',
  'Overcrowding',
  'Suspicious Activity',
  'Technical Issue',
];

const SEVERITY_LEVELS = ['Low', 'Medium', 'High', 'Critical'];

export default function IncidentReportScreen({ navigation }: any) {
  const { assignedGate, volunteerId } = useVolunteerStore();
  const [incidentType, setIncidentType] = useState(INCIDENT_TYPES[0]);
  const [location, setLocation] = useState(assignedGate || 'Gate 1');
  const [severity, setSeverity] = useState(SEVERITY_LEVELS[0]);
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const colors = useThemeColors();
  const styles = getStyles(colors);

  const handleTakePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Camera access is required to take photos.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions ? ImagePicker.MediaTypeOptions.Images : 'images' as any,
        allowsEditing: true,
        quality: 0.6,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setImageUri(result.assets[0].uri);
      }
    } catch (e: any) {
      Alert.alert('Error', 'Failed to launch camera: ' + e.message);
    }
  };

  const handleChooseFromGallery = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Media library access is required to select photos.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions ? ImagePicker.MediaTypeOptions.Images : 'images' as any,
        allowsEditing: true,
        quality: 0.6,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setImageUri(result.assets[0].uri);
      }
    } catch (e: any) {
      Alert.alert('Error', 'Failed to select photo: ' + e.message);
    }
  };

  const handleSubmit = async () => {
    if (!description.trim()) {
      Alert.alert('Validation Error', 'Please describe the incident.');
      return;
    }

    setLoading(true);
    setUploadProgress(0);
    try {
      const formData = new FormData();
      formData.append('incident_type', incidentType);
      formData.append('location', location.trim());
      formData.append('severity', severity);
      formData.append('description', description.trim());
      if (volunteerId) {
        formData.append('volunteer_id', volunteerId.toString());
      }

      if (imageUri) {
        const filename = imageUri.split('/').pop() || 'photo.jpg';
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : `image/jpeg`;
        
        formData.append('image', {
          uri: Platform.OS === 'ios' ? imageUri.replace('file://', '') : imageUri,
          name: filename,
          type: type,
        } as any);
      }

      await api.post('/incidents', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(progress);
          }
        },
      });

      Alert.alert('Incident Reported', 'Your incident report has been sent to Security Dispatch.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e: any) {
      const msg = e.response?.data?.detail || 'Failed to submit incident report.';
      Alert.alert('Report Failed', msg);
    } finally {
      setLoading(false);
      setUploadProgress(0);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.instructions}>
        Report safety issues or emergencies directly to the Central Admin Command Center. Fill out the details below.
      </Text>

      <GlassCard style={styles.formCard}>
        <Text style={styles.label}>Incident Type</Text>
        <View style={styles.selectRow}>
          {INCIDENT_TYPES.map((type) => (
            <TouchableOpacity
              key={type}
              style={[styles.selectBtn, incidentType === type && styles.selectActive]}
              onPress={() => setIncidentType(type)}
            >
              <Text style={[styles.selectText, incidentType === type && styles.selectTextActive]}>
                {type}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Location / Gate</Text>
        <TextInput
          style={styles.input}
          value={location}
          onChangeText={setLocation}
          placeholder="Enter incident location (e.g. Gate 3)"
          placeholderTextColor={colors.textSecondary}
        />

        <Text style={styles.label}>Severity Level</Text>
        <View style={styles.severityRow}>
          {SEVERITY_LEVELS.map((level) => {
            let activeColor = colors.blue;
            if (level === 'Critical') activeColor = colors.red;
            if (level === 'High') activeColor = colors.orange;

            return (
              <TouchableOpacity
                key={level}
                style={[
                  styles.severityBtn,
                  severity === level && { backgroundColor: activeColor, borderColor: activeColor },
                ]}
                onPress={() => setSeverity(level)}
              >
                <Text style={[styles.selectText, severity === level && styles.selectTextActive]}>
                  {level}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={description}
          onChangeText={setDescription}
          placeholder="Describe what is happening in detail..."
          placeholderTextColor={colors.textSecondary}
          multiline
          numberOfLines={4}
        />
      </GlassCard>

      <Text style={styles.label}>Photo Attachment</Text>
      <GlassCard style={styles.photoCard}>
        {imageUri ? (
          <View style={styles.previewWrapper}>
            <Image source={{ uri: imageUri }} style={styles.photoPreview} />
            <TouchableOpacity style={styles.removeBtn} onPress={() => setImageUri(null)}>
              <Text style={styles.removeBtnText}>✕ Remove Photo</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.photoButtonsRow}>
            <TouchableOpacity style={styles.photoBtn} onPress={handleTakePhoto}>
              <Text style={styles.photoBtnText}>📸 Take Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.photoBtn} onPress={handleChooseFromGallery}>
              <Text style={styles.photoBtnText}>🖼️ Choose Gallery</Text>
            </TouchableOpacity>
          </View>
        )}
      </GlassCard>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.blue} />
          {uploadProgress > 0 && (
            <Text style={styles.uploadProgressText}>Uploading: {uploadProgress}%</Text>
          )}
        </View>
      ) : (
        <ActionButton 
          title="🚨 Submit Incident Report" 
          variant="danger" 
          onPress={handleSubmit} 
          disabled={loading || uploadProgress > 0}
        />
      )}
    </ScrollView>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.navy,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  instructions: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 20,
    lineHeight: 20,
  },
  formCard: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 8,
    marginTop: 12,
  },
  selectRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  selectBtn: {
    backgroundColor: colors.navy === '#F5F6FA' ? 'rgba(255, 255, 255, 0.9)' : 'rgba(15, 23, 42, 0.5)',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  selectActive: {
    backgroundColor: colors.blue,
    borderColor: colors.blue,
  },
  selectText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  selectTextActive: {
    color: '#fff',
    fontWeight: 'bold',
  },
  input: {
    backgroundColor: colors.navy === '#F5F6FA' ? 'rgba(255, 255, 255, 0.9)' : 'rgba(15, 23, 42, 0.6)',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 44,
    color: colors.textPrimary,
    marginBottom: 12,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
    paddingVertical: 8,
  },
  severityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  severityBtn: {
    flex: 0.23,
    backgroundColor: colors.navy === '#F5F6FA' ? 'rgba(255, 255, 255, 0.9)' : 'rgba(15, 23, 42, 0.5)',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoCard: {
    marginBottom: 20,
    padding: 12,
  },
  previewWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  photoPreview: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    resizeMode: 'cover',
  },
  removeBtn: {
    position: 'absolute',
    bottom: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  removeBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  photoButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  photoBtn: {
    flex: 0.48,
    backgroundColor: colors.navy === '#F5F6FA' ? 'rgba(255, 255, 255, 0.9)' : 'rgba(15, 23, 42, 0.5)',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoBtnText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
  },
  uploadProgressText: {
    marginTop: 8,
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: 'bold',
  },
});
