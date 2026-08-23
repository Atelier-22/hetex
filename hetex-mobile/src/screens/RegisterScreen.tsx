import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useAuth } from "../context/AuthContext";
import type { RootStackParamList } from "../../App";

type Props = NativeStackScreenProps<RootStackParamList, "Register">;

export function RegisterScreen({ navigation }: Props) {
  const { register } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    setError(null);
    setLoading(true);
    try {
      await register(email, password, displayName || undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.logoCircle}>
        <Text style={styles.logoText}>H</Text>
      </View>
      <Text style={styles.title}>Create your Hetex AI account</Text>

      <TextInput
        style={styles.input}
        placeholder="Name"
        placeholderTextColor="#9caaa5"
        value={displayName}
        onChangeText={setDisplayName}
      />
      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="#9caaa5"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Password (min. 8 characters)"
        placeholderTextColor="#9caaa5"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <TouchableOpacity style={styles.button} onPress={handleRegister} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Create account</Text>}
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.navigate("Login")}>
        <Text style={styles.link}>Already have an account? Sign in</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0f0d", justifyContent: "center", padding: 24 },
  logoCircle: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: "#14b366",
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  logoText: { color: "#fff", fontSize: 24, fontWeight: "700" },
  title: { color: "#eef4f1", fontSize: 20, fontWeight: "600", textAlign: "center", marginBottom: 24 },
  input: {
    backgroundColor: "#101613",
    borderWidth: 1,
    borderColor: "#1d2521",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#eef4f1",
    marginBottom: 12,
    fontSize: 15,
  },
  error: { color: "#ef4444", marginBottom: 12, fontSize: 13 },
  button: {
    backgroundColor: "#14b366",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
  },
  buttonText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  link: { color: "#37cf80", textAlign: "center", marginTop: 20, fontSize: 14 },
});
