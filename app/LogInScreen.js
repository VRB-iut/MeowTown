import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import {
  Animated,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import COLOR from "../global_vars/COLOR";
import IP from "../global_vars/IP";

export default function LoginScreen() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [checkExisted, setCheckExisted] = useState(null);
  const [logIn, setLogIn] = useState(true);
  const [accountCreated, setAccountCreated] = useState(false);
  const router = useRouter();
  const opacity = useRef(new Animated.Value(0)).current;

  const handleLogin = async () => {
    try {
      setCheckExisted(null);
      const normalizedUsername = username.trim();
      const normalizedPassword = password.trim();

      const response = await fetch(`http://${IP}:3000/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: normalizedUsername,
          password: normalizedPassword,
        }),
      });

      const data = await response.json();

      if (data.success) {
        await AsyncStorage.setItem("userId", String(data.userId));
        router.replace("/Dashboard");
      } else {
        setCheckExisted(false);
      }
    } catch (error) {
      console.log(error);
      setCheckExisted(false);
    }
  };

  const handleRegister = async () => { 
    console.log(
      "Attempting to register with: ",
      username,
      password,
      confirmPassword,
    );
    try {
      console.log("test");
      const response = await fetch(`http://${IP}:3000/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, confirmPassword }),
      });
      console.log("STATUS: ", response.status);
      const data = await response.json();
      console.log(data);

      if (data.success) {
        setAccountCreated(true);
        setLogIn(true);
        setUsername("");
        setPassword("");
        setConfirmPassword("");
        createAccountMessage();
        setCheckExisted(null);
      } else {
        setCheckExisted(false);
      }
    } catch (error) {
      console.log(error);
      setCheckExisted(false);
    }
  };

  const createAccountMessage = () => {
    opacity.setValue(1);

    setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 1000,
        useNativeDriver: true,
      }).start(() => setAccountCreated(false));
    }, 1000);
  };

  return (
    <View style={styles.container}>
      {logIn ? (
        <View style={styles.containerLogIn}>
          <Text style={styles.logInText}>WELCOME</Text>
          <TextInput
            style={[styles.nameInput, { marginTop: "10%" }]}
            placeholder="Username"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
          />
          <TextInput
            style={[styles.passwordInput, { marginTop: "10%" }]}
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
          />
          {checkExisted === false && (
            <Text
              style={{ color: "red", alignSelf: "center", marginTop: "15%" }}
            >
              Invalid username or password
            </Text>
          )}

          <TouchableOpacity style={styles.logInButton} onPress={handleLogin}>
            <Text style={styles.logInButtonText}>Log In</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.containerLogIn}>
          <Text style={styles.logInText}>WELCOME</Text>
          <TextInput
            style={[styles.nameInput, { marginTop: "5.5%" }]}
            placeholder=" Username"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
          />
          <TextInput
            style={[styles.passwordInput, { marginTop: "5.5%" }]}
            placeholder=" Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
          />
          <TextInput
            style={[styles.confirmPasswordInput, { marginTop: "5.5%" }]}
            placeholder=" Confirm Password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            autoCapitalize="none"
          />
          {checkExisted === false && (
            <Text
              style={{ color: "red", alignSelf: "center", marginTop: "15%" }}
            >
              Invalid username or password
            </Text>
          )}

          <TouchableOpacity style={styles.logInButton} onPress={handleRegister}>
            <Text style={styles.logInButtonText}>Sign Up</Text>
          </TouchableOpacity>
        </View>
      )}

      {logIn === true ? (
        <View style={styles.containerSignUp}>
          <Text style={{ color: "#afafaf" }}>Don't have an account?</Text>
          <TouchableOpacity
            onPress={() => {
              (setLogIn(false), setCheckExisted(null));
            }}
          >
            <Text style={styles.signUpText}>Sign Up</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.containerSignUp}>
          <Text style={{ color: "#afafaf" }}>Already have an account?</Text>
          <TouchableOpacity
            onPress={() => {
              (setLogIn(true), setCheckExisted(null));
            }}
          >
            <Text style={styles.signUpText}>Log in</Text>
          </TouchableOpacity>
        </View>
      )}

      {accountCreated && (
        <Animated.Text style={[styles.accountCreatedText, { opacity }]}>
          Account created successfully!
        </Animated.Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLOR.light.background,
    alignItems: "center",
    justifyContent: "center",
  },
  containerLogIn: {
    width: "80%",
    height: "50%",
    borderWidth: 2,
    borderRadius: 24,
    borderColor: COLOR.light.primary,
    backgroundColor: COLOR.light.background,
    shadowColor: COLOR.light.primary,
    elevation: 5,
  },
  logInText: {
    fontSize: 40,
    color: COLOR.light.secondary,
    alignSelf: "center",
    fontWeight: "bold",
    marginTop: "10%",
  },
  nameInput: {
    marginTop: "10%",
    marginHorizontal: 20,
    borderWidth: 1,
    borderBottomWidth: 1,
    color: "#000",
    borderRadius: 9,
    borderColor: COLOR.light.primary,
    backgroundColor: "#fafafa07",
  },
  passwordInput: {
    marginTop: "10%",
    marginHorizontal: 20,
    borderWidth: 1,
    borderBottomWidth: 1,
    borderRadius: 9,
    borderColor: COLOR.light.primary,
    backgroundColor: "#fafafa07",
    color: "#000",
  },
  confirmPasswordInput: {
    marginTop: "10%",
    marginHorizontal: 20,
    borderWidth: 1,
    borderBottomWidth: 1,
    borderRadius: 9,
    borderColor: COLOR.light.primary,
    backgroundColor: "#fafafa07",
    color: "#000",
  },
  accountCreatedText: {
    position: "absolute",
    marginTop: "65%",
    color: "green",
    fontSize: 16,
  },
  logInButton: {
    flex: 1,
    justifyContent: "flex-end",
    paddingBottom: "10%",
  },
  logInButtonText: {
    alignSelf: "center",
    borderBottomWidth: 1,
    borderColor: COLOR.light.primary,
    fontSize: 20,
    borderRadius: 28,
    paddingHorizontal: "25%",
    paddingVertical: "5%",
    fontWeight: "bold",
    color: COLOR.primary,
  },
  containerSignUp: {
    position: "absolute",
    bottom: "5%",
    flexDirection: "row",
    gap: 5,
  },
  signUpText: {
    color: COLOR.light.secondary,
    textDecorationLine: "underline",
  },
});