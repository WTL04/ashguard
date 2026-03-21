import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { useRouter } from 'expo-router';

export default function RecommendationsScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>

      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="#111" />
        </Pressable>
        <Text style={styles.title}>Recommendations</Text>
      </View>
      
      <View style={styles.headerLine} />

      <View style={styles.content}>
        

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({

  container: {
    flex: 1,
    backgroundColor: 'white',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },

  backButton: {
    marginRight: 40,
  },

  title: {
    fontSize: 25, 
    fontWeight: "700", 
    textAlign: "center", 
    marginVertical: 12 
  },

 headerLine: {
    height: 1, 
    backgroundColor: '#F2F2F2', 
    width: '100%'
  },

  content: {
    flex: 1,
    padding: 20,
  },

});