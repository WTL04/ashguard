import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

type SafetyStatus = 'SAFE' | 'NEED HELP!' | 'IN DANGER';

const GROUP_NAME_KEY = 'emergency_group_name';
const SAFETY_STATUS_KEY = 'emergency_group_safety_status';
const MEETUP_ADDRESS_KEY = 'emergency_group_meetup_address';

export default function EmergencyGroupScreen() {
  const insets = useSafeAreaInsets();

  const [groupName, setGroupName] = useState('Name of Group');
  const [isEditingName, setIsEditingName] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<SafetyStatus>('SAFE');
  const [meetupAddress, setMeetupAddress] = useState('');
  const [isLoaded, setIsLoaded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadSavedData();
    }, [])
  );

  const loadSavedData = async () => {
    try {
      const savedGroupName = await AsyncStorage.getItem(GROUP_NAME_KEY);
      const savedStatus = await AsyncStorage.getItem(SAFETY_STATUS_KEY);
      const savedMeetupAddress = await AsyncStorage.getItem(MEETUP_ADDRESS_KEY);

      if (savedGroupName) {
        setGroupName(savedGroupName);
      }

      if (
        savedStatus === 'SAFE' ||
        savedStatus === 'NEED HELP!' ||
        savedStatus === 'IN DANGER'
      ) {
        setSelectedStatus(savedStatus);
      }

      setMeetupAddress(savedMeetupAddress || '');
    } catch (error) {
      console.log('Error loading group data:', error);
    } finally {
      setIsLoaded(true);
    }
  };

  const saveGroupName = async (newName: string) => {
    try {
      await AsyncStorage.setItem(GROUP_NAME_KEY, newName);
    } catch (error) {
      console.log('Error saving group name:', error);
    }
  };

  const saveSafetyStatus = async (status: SafetyStatus) => {
    try {
      await AsyncStorage.setItem(SAFETY_STATUS_KEY, status);
    } catch (error) {
      console.log('Error saving safety status:', error);
    }
  };

  const handleFinishEditingName = async () => {
    const trimmedName = groupName.trim();

    if (trimmedName.length === 0) {
      setGroupName('Name of Group');
      await saveGroupName('Name of Group');
    } else {
      setGroupName(trimmedName);
      await saveGroupName(trimmedName);
    }

    setIsEditingName(false);
  };

  const handleSelectStatus = async (status: SafetyStatus) => {
    setSelectedStatus(status);
    await saveSafetyStatus(status);
  };

  const getStatusStyle = (status: SafetyStatus) => {
    const isSelected = selectedStatus === status;

    if (status === 'SAFE') {
      return {
        backgroundColor: isSelected ? '#57C61A' : '#EAF8DF',
        borderColor: '#57C61A',
        textColor: isSelected ? '#FFFFFF' : '#2F8F12',
      };
    }

    if (status === 'NEED HELP!') {
      return {
        backgroundColor: isSelected ? '#FFB300' : '#FFF4D6',
        borderColor: '#FFB300',
        textColor: isSelected ? '#FFFFFF' : '#B57600',
      };
    }

    return {
      backgroundColor: isSelected ? '#F15A3B' : '#FFE2DC',
      borderColor: '#F15A3B',
      textColor: isSelected ? '#FFFFFF' : '#B63B23',
    };
  };

  if (!isLoaded) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" backgroundColor="#F58500" />
      </SafeAreaView>
    );
  }

  return (
    <>
      <StatusBar style="light" backgroundColor="#F58500" />

      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.screen}>
          <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backButton}
            >
              <Ionicons name="chevron-back" size={26} color="#fff" />
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.9}
              style={styles.headerTitleWrap}
              onPress={() => setIsEditingName(true)}
            >
              {isEditingName ? (
                <TextInput
                  value={groupName}
                  onChangeText={setGroupName}
                  autoFocus
                  style={styles.headerInput}
                  placeholder="Enter group name"
                  placeholderTextColor="#667"
                  onBlur={handleFinishEditingName}
                  onSubmitEditing={handleFinishEditingName}
                  returnKeyType="done"
                />
              ) : (
                <>
                  <Text style={styles.headerTitle} numberOfLines={1}>
                    {groupName}
                  </Text>

                  <TouchableOpacity
                    onPress={() => setIsEditingName(true)}
                    style={styles.headerPencil}
                  >
                    <Ionicons name="pencil" size={16} color="#111" />
                  </TouchableOpacity>
                </>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            <TouchableOpacity
              style={styles.card}
              activeOpacity={0.9}
              onPress={() => router.push('/(tabs)/groups/contactmembers')}
            >
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderLeft}>
                  <Ionicons name="people-outline" size={24} color="#fff" />
                  <Text style={styles.cardHeaderText}>Contact members</Text>
                </View>

                <Ionicons name="chevron-forward" size={24} color="#fff" />
              </View>

              <Text style={styles.cardBodyText}>
                Add new members to your group or view current members.
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.card}
              activeOpacity={0.9}
              onPress={() => router.push('/(tabs)/groups/locationmeetup')}
            >
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderLeft}>
                  <Ionicons name="location-outline" size={24} color="#fff" />
                  <Text style={styles.cardHeaderText}>Location & Meetup</Text>
                </View>

                <Ionicons name="chevron-forward" size={24} color="#fff" />
              </View>

              {meetupAddress ? (
                <View style={styles.meetupContent}>
                  <View style={styles.meetupSavedRow}>
                    <Text style={styles.meetupSavedText} numberOfLines={1}>
                      {meetupAddress}
                    </Text>

                    <Ionicons name="create-outline" size={18} color="#F58500" />
                  </View>
                </View>
              ) : (
                <Text style={styles.cardBodyText}>
                  View current members location and designate a specific meetup
                  location for group members to gather at.
                </Text>
              )}
            </TouchableOpacity>

            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderLeft}>
                  <Ionicons name="pulse-outline" size={24} color="#fff" />
                  <Text style={styles.cardHeaderText}>Check In</Text>
                </View>
              </View>

              <View style={styles.checkInBody}>
                <Text style={styles.statusLabel}>SAFETY STATUS</Text>

                <View style={styles.statusGrid}>
                  {(['SAFE', 'NEED HELP!', 'IN DANGER'] as SafetyStatus[]).map(
                    (status) => {
                      const style = getStatusStyle(status);
                      const isSelected = selectedStatus === status;

                      return (
                        <TouchableOpacity
                          key={status}
                          activeOpacity={0.9}
                          onPress={() => handleSelectStatus(status)}
                          style={[
                            styles.statusBox,
                            {
                              backgroundColor: style.backgroundColor,
                              borderColor: style.borderColor,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.statusBoxText,
                              { color: style.textColor },
                            ]}
                          >
                            {status}
                          </Text>

                          {isSelected && (
                            <Ionicons
                              name="checkmark-circle"
                              size={18}
                              color={style.textColor}
                              style={styles.statusCheck}
                            />
                          )}
                        </TouchableOpacity>
                      );
                    }
                  )}
                </View>

                <Text style={styles.cardBodyTextNoPad}>
                  Update your group in case of possible life threatening
                  situations nearby.
                </Text>
              </View>
            </View>
          </View>
        </View>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F3F3',
  },
  screen: {
    flex: 1,
  },
  header: {
    backgroundColor: '#F58500',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingBottom: 16,
  },
  backButton: {
    marginRight: 10,
    padding: 2,
  },
  headerTitleWrap: {
    flex: 1,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFF4E8',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 16,
    paddingRight: 10,
  },
  headerTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
    textAlign: 'center',
    marginLeft: 18,
  },
  headerPencil: {
    marginLeft: 8,
    padding: 4,
  },
  headerInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
    textAlign: 'center',
    paddingVertical: 0,
  },
  content: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 22,
    paddingBottom: 22,
    gap: 26,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
    overflow: 'hidden',
  },
  cardHeader: {
    backgroundColor: '#F58500',
    minHeight: 60,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cardHeaderText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
  },
  cardBodyText: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 18,
    fontSize: 14,
    lineHeight: 22,
    color: '#555',
  },
  meetupContent: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 14,
  },
  meetupSavedRow: {
    minHeight: 42,
    borderRadius: 21,
    borderWidth: 1.5,
    borderColor: '#F58500',
    backgroundColor: '#FFF8EF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
  },
  meetupSavedText: {
    flex: 1,
    marginRight: 10,
    color: '#D97706',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  checkInBody: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 18,
  },
  statusLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#111',
    marginBottom: 14,
  },
  statusGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 18,
  },
  statusBox: {
    flex: 1,
    minHeight: 74,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    position: 'relative',
  },
  statusBoxText: {
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
  statusCheck: {
    position: 'absolute',
    top: 6,
    right: 6,
  },
  cardBodyTextNoPad: {
    fontSize: 14,
    lineHeight: 22,
    color: '#555',
  },
});