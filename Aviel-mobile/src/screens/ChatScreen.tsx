import React, { useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";

type Message = { id: string; role: "user" | "assistant"; content: string };

export function ChatScreen() {
  const { user, logout } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<FlatList>(null);

  async function sendMessage() {
    const text = input.trim();
    if (!text || sending) return;

    setError(null);
    setInput("");
    const userMsg: Message = { id: Date.now().toString(), role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setSending(true);

    try {
      const res = await api.sendMessage(text, conversationId);
      setConversationId(res.conversationId);
      setMessages((prev) => [
        ...prev,
        { id: (Date.now() + 1).toString(), role: "assistant", content: res.reply },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSending(false);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Aviel AI</Text>
        <TouchableOpacity onPress={logout}>
          <Text style={styles.headerLogout}>Log out</Text>
        </TouchableOpacity>
      </View>

      {messages.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoText}>H</Text>
          </View>
          <Text style={styles.emptyText}>Hi {user?.displayName ?? user?.email}, what can I help with?</Text>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.messageList}
          renderItem={({ item }) => (
            <View
              style={[
                styles.bubble,
                item.role === "user" ? styles.userBubble : styles.assistantBubble,
              ]}
            >
              <Text style={item.role === "user" ? styles.userText : styles.assistantText}>
                {item.content}
              </Text>
            </View>
          )}
        />
      )}

      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          placeholder="Message Aviel AI..."
          placeholderTextColor="#9caaa5"
          value={input}
          onChangeText={setInput}
          multiline
        />
        <TouchableOpacity style={styles.sendButton} onPress={sendMessage} disabled={sending}>
          {sending ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.sendText}>➤</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0f0d" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1d2521",
  },
  headerTitle: { color: "#eef4f1", fontSize: 16, fontWeight: "600" },
  headerLogout: { color: "#9caaa5", fontSize: 13 },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  logoCircle: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#14b366",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  logoText: { color: "#fff", fontSize: 20, fontWeight: "700" },
  emptyText: { color: "#9caaa5", fontSize: 15, textAlign: "center" },
  messageList: { padding: 16, gap: 10 },
  bubble: { maxWidth: "85%", borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 8 },
  userBubble: { backgroundColor: "#14b366", alignSelf: "flex-end" },
  assistantBubble: { backgroundColor: "#101613", borderWidth: 1, borderColor: "#1d2521", alignSelf: "flex-start" },
  userText: { color: "#fff", fontSize: 15 },
  assistantText: { color: "#eef4f1", fontSize: 15 },
  errorBanner: { backgroundColor: "rgba(239,68,68,0.1)", padding: 10, marginHorizontal: 16, borderRadius: 10 },
  errorText: { color: "#ef4444", fontSize: 13 },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: 12,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: "#1d2521",
  },
  input: {
    flex: 1,
    backgroundColor: "#101613",
    borderWidth: 1,
    borderColor: "#1d2521",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: "#eef4f1",
    fontSize: 15,
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#14b366",
    alignItems: "center",
    justifyContent: "center",
  },
  sendText: { color: "#fff", fontSize: 16 },
});
