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

type Props = NativeStackScreenProps<RootStackParamList, "Login">;

export function LoginScreen({ navigation }: Props) {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
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
      <Text style={styles.title}>Welcome back to Aviel AI</Text>

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
        placeholder="Password"
        placeholderTextColor="#9caaa5"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign in</Text>}
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.navigate("Register")}>
        <Text style={styles.link}>No account? Create one</Text>
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
