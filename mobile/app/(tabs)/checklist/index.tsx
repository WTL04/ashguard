import React, {useState} from 'react';
import { View, Text, StyleSheet, Pressable, Modal, TextInput, FlatList, Platform, KeyboardAvoidingView  } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';

interface ItemInChecklist {
    id: string;
    text: string;
    isDone: boolean;
}

export default function ChecklistScreen() {

    const [items, setItems] = useState<ItemInChecklist[]>([]);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [inputText, setInputText] = useState('');

    const addItem = () => {
        if (inputText.trim().length > 0) {
            const newItem: ItemInChecklist = {
                id: Date.now().toString(),
                text: inputText,
                isDone:false,
            };
            setItems([...items, newItem]);
            setInputText('');
            setIsModalVisible(false);
        }
    };

    const toggleItem = (id: string) => {
        setItems(prev => prev.map(item =>
            item.id == id ? { ...item, isDone: !item.isDone } : item));
    };

    const deleteItem = (id: string) => {
        setItems(prev => prev.filter(item => item.id !== id));
    };


return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text style={styles.title}>Checklist</Text>
      <View style={styles.headerLine} />

      <View style={styles.content}>
        {items.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="list" size={80} color="#E0E0E0" />
            <Text style={styles.emptyText}>Your checklist is currently empty.</Text>
            <Text style={styles.emptySubText}>Press the + or the lightbulb to start adding items.</Text>
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContainer}
            renderItem={({ item }) => (
              <View style={styles.itemRow}>
                <Pressable onPress={() => toggleItem(item.id)} style={styles.checkbox}>
                  <Ionicons 
                    name={item.isDone ? "checkmark-circle" : "ellipse-outline"} 
                    size={32} 
                    color={Colors.primary} />
                </Pressable>
                
                <Text style={[styles.itemText, item.isDone && styles.itemTextDone]}>
                  {item.text}
                </Text>

                <Pressable onPress={() => deleteItem(item.id)}>
                  <Ionicons name="trash-outline" size={24} color="#E74C3C" />
                </Pressable>
              </View>
            )}
          />
        )}

        <Modal visible={isModalVisible} animationType="slide" transparent={true}>
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
            style={styles.modalOverlay}>

            <View style={styles.modalContent}>
              <Text style={styles.modalHeader}>Add New Item</Text>
              <TextInput
                style={styles.inputBox}
                placeholder="e.g., Medicine, Water, ..."
                value={inputText}
                onChangeText={setInputText}
                autoFocus={true}
                onSubmitEditing={addItem}
                returnKeyType="done"
              />
              <View style={styles.modalButtons}>
                <Pressable style={styles.cancelButton} onPress={() => setIsModalVisible(false)}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </Pressable>
                <Pressable style={styles.saveButton} onPress={addItem}>
                  <Text style={styles.saveButtonText}>Add Item</Text>
                </Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        <Pressable style={styles.addRecommendations}>
          <Ionicons name="bulb" size={32} color="white" />
        </Pressable>

        <Pressable style={styles.addItemButton} onPress={() => setIsModalVisible(true)}>
          <Ionicons name="add-circle" size={75} color={Colors.primary} />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, 
    backgroundColor: '#FFFFFF' 
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
    flex: 1
  },
  
  
  listContainer: {
    paddingTop: 20,
    paddingBottom: 120, 
  },


  itemRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 16, 
    marginHorizontal: 20,
    marginVertical: 8,
    borderWidth: 2,
    borderColor: Colors.primary,
    borderRadius: 14,
    backgroundColor: 'white',
  },

  checkbox: {
    marginRight: 4
  },

  itemText: { 
    fontSize: 20, 
    color: Colors.primary, 
    fontWeight: '600', 
    flex: 1,
    marginLeft: 8 
  },

  itemTextDone: { 
    textDecorationLine: 'line-through', 
    opacity: 0.6
  },


  emptyContainer: {
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    paddingBottom: 100
  },

  emptyText: {
    fontSize: 18, 
    fontWeight: '600', 
    color: '#95A5A6', 
    marginTop: 10
  },  


  emptySubText: {
    fontSize: 14, 
    color: '#BDC3C7'
  },

  modalOverlay: {
    flex: 1, 
    backgroundColor: "#00000066", 
    justifyContent: 'center', 
    alignItems: 'center'
  },


  modalContent: {
    width: '85%', 
    backgroundColor: 'white', 
    borderRadius: 24, 
    padding: 25, 
    elevation: 10
  },


  modalHeader: {
    fontSize: 22, 
    fontWeight: '800', 
    marginBottom: 20, 
    color: '#2C3E50'
  },


  inputBox: {
    borderBottomWidth: 2, 
    borderBottomColor: Colors.primary, 
    fontSize: 18, 
    paddingVertical: 10, 
    marginBottom: 25, 
    color: '#2C3E50'
  },


  modalButtons: {
    flexDirection: 'row', 
    justifyContent: 'center', 
    gap: 20
  }, 


  cancelButton: {
    backgroundColor: "gray", 
    paddingHorizontal: 25, 
    paddingVertical: 12, 
    borderRadius: 12 
  },

  cancelButtonText: {
    color: 'white', 
    fontWeight: '700', 
    fontSize: 16
  },


  saveButton: { 
    backgroundColor: Colors.primary, 
    paddingHorizontal: 25, 
    paddingVertical: 12, 
    borderRadius: 12 
    },

  saveButtonText: {
    color: 'white', 
    fontWeight: '700', 
    fontSize: 16
  },

 
  addItemButton: {
    position: 'absolute', 
    bottom: 25, 
    right: 20 
  },

  addRecommendations: { 
    position: 'absolute', 
    bottom: 32, 
    left: 20, 
    width: 60, 
    height: 60, 
    borderRadius: 30, 
    backgroundColor: Colors.primary, 
    justifyContent: 'center', 
    alignItems: 'center',
  },
});