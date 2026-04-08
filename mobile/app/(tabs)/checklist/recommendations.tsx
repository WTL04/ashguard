import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { useRouter } from 'expo-router';
import { useChecklist } from '@/context/checklistContext';

const RECOMMENDATIONS = [
  { id: '1', name: 'Passports/Social Security', 
    description: 'Important documents like passports and social security cards are crucial for identity proof. After a fire, these make recovery much easier and faster.'},
  { id: '2', name: 'Water (3-Day Supply)', 
    description: 'Dehydration happens fast in high heat. Ensure you have 1 gallon per person per day for at least three days.'},
  { id: '3', name: 'Flashlight & Batteries', 
    description: 'Power lines often fail or are cut during fires; you will need a reliable light source for navigation.'},
  { id: '4', name: 'N95 Respirator Masks', 
    description: 'Smoke inhalation is a leading cause of fire-related injury. N95 masks filter out fine particles from wildfire smoke to protect your lungs.'},
  { id: '5', name: 'Portable Power Bank', 
    description: 'If the power goes out, your phone is your lifeline for AshGuard alerts and navigation. Keep a fully charged bank ready to go.'},
  { id: '6', name: 'First Aid Kit', 
    description: 'Essential for treating minor burns, cuts, or abrasions. Include sterile bandages, antiseptic, and burn ointment.'},
];

const TAN = "#ffcdaf";

//template for each item
const RecommendationItem = ({ item, isChecked, onChecked }: any) => {
  const [dropdown, setDropdown] = useState(false);

  return (
    <View key={item.id} style={styles.recommendationGap}>
      
      <View style={styles.recommendationContainer}>

        <View style={styles.itemRow}>
          <Pressable onPress={() => onChecked(item)} style={styles.checkbox}>
            <Ionicons 
              name={isChecked ? "checkmark-circle" : "ellipse-outline"} 
              size={36} 
              color="#ffffff" 
            />
          </Pressable>
          

          <Pressable style={{ flex: 1 }} onPress={() => setDropdown(!dropdown)}>
            <Text style={styles.itemText}>{item.name}</Text>
          </Pressable>


          <Pressable onPress={() => setDropdown(!dropdown)}>
            <Ionicons 
              name={dropdown ? "chevron-up" : "chevron-down"} 
              size={28} 
              color="#ffffff" 
            />
          </Pressable>
        </View>
      </View>


      {dropdown && (
        <View style={styles.descriptionBox}>
          <Text style={styles.descriptionText}>{item.description}</Text>
        </View>
      )}
    </View>
  );
};


export default function RecommendationsScreen() {
  const router = useRouter();
  const { checklist, toggleItem } = useChecklist();

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
        <ScrollView contentContainerStyle={styles.scrollContainer}>


          {RECOMMENDATIONS.map((item) => (
            <RecommendationItem 
              key={item.id}
              item={item}
              isChecked={checklist.some((c: any) => c.id === item.id)}
              onChecked={toggleItem}
            />
          ))}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}


const styles = StyleSheet.create({

  container: { 
    flex: 1, 
    backgroundColor: '#fff' 
  },

  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 20, 
    paddingVertical: 15 
  },

  backButton: { 
    marginRight: 45 
  },

  title: { 
    fontSize: 24, 
    fontWeight: 'bold', 
    color: '#111' 
  },

  headerLine: { 
    height: 1, 
    backgroundColor: '#EEE', 
    marginHorizontal: 20 
  },

  content: { 
    flex: 1 
  },
  
  scrollContainer: { 
    padding: 20, 
    paddingBottom: 60 
  },

  recommendationGap: {
    marginBottom: 25, 
  },

  recommendationContainer: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: '#ECECEC',
  },

  itemRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
  },

  checkbox: { 
    marginRight: 15 
  },

  itemText: { 
    fontSize: 18, 
    color: '#ffffff', 
    fontWeight: '800', 
  },

  descriptionBox: { 
    backgroundColor: TAN,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    padding: 20,
    marginTop: -2, 
    borderWidth: 1,
    borderColor: '#ECECEC',
    borderTopWidth: 0, 
  },

  descriptionText: { 
    fontSize: 16, 
    color: '#333', 
    lineHeight: 24, 
    fontWeight: '500',
  },
});