import React from "react";
import { View, Text, StyleSheet, Pressable, TextInput, Alert, ScrollView, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { auth, db } from "@/lib/firebaseConfig";
import { isFieldTaken, updateUserProfile } from "@/lib/authService";
import { doc, getDoc } from "firebase/firestore";
import { useEffect } from "react";
import * as ImagePicker from 'expo-image-picker'

const background = "#FFFFFF";
const text = "#111111";
const bginput = "#F4E3DC";
const orange = "#F59E0B";
const gray = "#BDBDBD";

export default function EditProfileScreen() {
  const router = useRouter();

  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [username, setUsername] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [imageUri, setImageUri] = React.useState<string | null>(null)

  const handlePhone = (val: string) => {
    const d = val.replace(/\D/g, '').slice(0, 10);
    let out = d;
    if (d.length > 6)      out = `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
    else if (d.length > 3) out = `(${d.slice(0, 3)}) ${d.slice(3)}`;
    else if (d.length > 0) out = `(${d}`;
    setPhone(out);
  };

  React.useEffect(() => {
  const loadInfo = async () => {
    try {
      const user = auth.currentUser;
      if (user) {
        const userRef = doc(db, "users", user.uid);
        const snapshot = await getDoc(userRef);

        if (snapshot.exists()) {
          const data = snapshot.data();
          setFirstName(data.firstName || "");
          setLastName(data.lastName || "");
          setUsername(data.username || "");
          if (data.phone) {
            handlePhone(data.phone);
          } else {
            setPhone("")
          }
          setEmail(data.email || "");
          setImageUri(data.photoURL || null);
        }
      }
    } catch (error) {
      console.error("Error loading info:", error);
    }
  };

  loadInfo();
}, []); 

const pickImage = async () => {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert("Permission Denied", "We need gallery access!");
    return;
  }

  let result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.2,   
    base64: true,  
  });

  if (!result.canceled) {
    const base64String = `data:image/jpeg;base64,${result.assets[0].base64}`;
    setImageUri(base64String); 
  }
};

const handleUpdate = async () => {
  const user = auth.currentUser;
  if (!user) return;

  const usernameTaken = await isFieldTaken("username", username, user.uid);
  if (usernameTaken) {
    Alert.alert("Error", "Username is already being used by another account.");
    return;
  }

  const phoneTaken = await isFieldTaken("phone", phone, user.uid);
  if (phoneTaken) {
    Alert.alert("Invalid Phone", "This phone number you chose is already being used by another account.");
    return;
  }

  const emailTaken = await isFieldTaken("email", email, user.uid);
  if (emailTaken) {
    Alert.alert("Invalid Email", "This email address you chose is already in use.");
    return;
  }


  Alert.alert("Save Changes", "Are you sure you want make these changes to your profile?", [
    { text: "Cancel", style: "cancel" },
    { 
      text: "Update", 
      onPress: async () => {
        try {

          const result = await updateUserProfile(user.uid, {
            firstName,
            lastName,
            username,
            phone,
            email,
            photoURL: imageUri, 
          });

          if (result.success) {
            Alert.alert("Success", "Profile updated has been successfully!");
            router.back(); 
          } else {
            Alert.alert("Error", "We were not able update profile.");
          }
        } catch (error) {
          console.error(error);
          Alert.alert("Error", "An unexpected error occurred.");
        }
      } 
    }
  ]);
};

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
            {imageUri ? (
              <Image 
                source={{ uri: imageUri }} 
                style={{ width: 120, height: 120, borderRadius: 60 }} 
              />
            ) : (
                <Ionicons name="person" size={50} color="#5c5957" />
            )}
          </View>

           
           <Pressable style={styles.changePicButton} onPress={pickImage}>
             <Text style={styles.changePicText}>Change Picture</Text>
           </Pressable>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>First Name</Text>
          <TextInput style={styles.input} 
          placeholder="First Name..." 
          value={firstName}
          onChangeText={setFirstName}
          />
  
          <Text style={[styles.label, { marginTop: 15 }]}>Last Name</Text>
          <TextInput style={styles.input} 
          placeholder="Last Name..." 
          value={lastName}
          onChangeText={setLastName}
          />

          <Text style={[styles.label, { marginTop: 15 }]}>Username</Text>
          <TextInput style={styles.input} 
          placeholder="Username..." 
          value={username}
          onChangeText={setUsername}
          />

          <Text style={[styles.label, { marginTop: 15 }]}>Phone Number</Text>
          <TextInput style={styles.input} 
          placeholder="(XXX) XXX-XXXX"
          value={phone}
          onChangeText={handlePhone}
          maxLength={14} 
          />

          <Text style={[styles.label, { marginTop: 15 }]}>Email</Text>
          <TextInput style={styles.input} 
          placeholder="Email..." 
          value={email}
          onChangeText={setEmail}
          />

        </View>

        <View style={styles.buttonRow}>
           <Pressable style={styles.cancelButton}>
             <Text style={styles.cancelButtonText}>Cancel</Text>
           </Pressable>
           <Pressable style={styles.updateButton} onPress={handleUpdate}>
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