import React from "react";
import { ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { View, Text, StyleSheet, Pressable, TextInput, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

const background = "#FFFFFF";
const text = "#111111";
const bginput = "#F4E3DC";
const orange = "#F59E0B";
const gray = "#BDBDBD";

export default function EditProfileScreen() {
  const router = useRouter();

return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="black" />
        </Pressable>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <View style={{ width: 24 }} /> 
      </View>

  
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        <View style={styles.avatarSection}>
           <View style={styles.avatarCircle}>
             <Ionicons name="person" size={50} color="#5c5957" />
           </View>
           <Pressable style={styles.changePicButton}>
             <Text style={styles.changePicText}>Change Picture</Text>
           </Pressable>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>First Name</Text>
          <TextInput style={styles.input} placeholder="First Name..." />
  
          <Text style={[styles.label, { marginTop: 15 }]}>Last Name</Text>
          <TextInput style={styles.input} placeholder="Last Name..." />

          <Text style={[styles.label, { marginTop: 15 }]}>Username</Text>
          <TextInput style={styles.input} placeholder="Username..." />

          <Text style={[styles.label, { marginTop: 15 }]}>Phone Number</Text>
          <TextInput style={styles.input} placeholder="Phone Number..." />

          <Text style={[styles.label, { marginTop: 15 }]}>Email</Text>
          <TextInput style={styles.input} placeholder="Email..." />
        </View>

        <View style={styles.buttonRow}>
           <Pressable style={styles.cancelButton}>
             <Text style={styles.cancelButtonText}>Cancel</Text>
           </Pressable>
           <Pressable style={styles.updateButton}>
             <Text style={styles.updateButtonText}>Update</Text>
           </Pressable>
        </View>

      </ScrollView>
    </SafeAreaView>
  )};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 15,
  },

  backButton: {
    padding: 5,
  },

  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
  },

  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  centerText: {
    fontSize: 16,
    color: "#666",
  },

  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },

  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 30,
  },

  updateButton: {
    backgroundColor: orange,
    marginTop: 16,
    alignSelf: "center",
    width: 130,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },

  updateButtonText: {
    color: background,
    fontSize: 12.5,
    fontWeight: "800",
  },

  cancelButton: {
    backgroundColor: gray,
    marginTop: 16,
    alignSelf: "center",
    width: 130,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },

  cancelButtonText: {
    color: text,
    fontSize: 12.5,
    fontWeight: "800",
  },

  input: {
    backgroundColor: bginput,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 13,
  },

  form: {
    marginTop: 18
  },

  label: {
    fontSize: 12.5,
    fontWeight: "700", 
    color: text, 
    marginBottom: 8
  },

  avatarSection: {
    alignItems: 'center',
    marginVertical: 20,
  },

  avatarCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#FDEBD0",
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10
  },

  changePicButton: {
    backgroundColor: text,
    marginTop: 16,
    alignSelf: "center",
    width: 130,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },

  changePicText: {
    color: background,
    fontWeight: '700',
    fontSize: 14,
  },





});