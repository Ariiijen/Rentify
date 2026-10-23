import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';

import { auth, db } from '../../firebaseConfig';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { colors } from '@/constants/rentify-theme';
import type { UserRole } from '@/types';

function getAuthErrorMessage(error: unknown) {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String(error.code)
      : '';

  switch (code) {
    case 'auth/invalid-email':
      return 'Enter a valid email address and try again.';
    case 'auth/invalid-credential':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      return 'That email and password combination was not recognized.';
    case 'auth/email-already-in-use':
      return 'An account already exists for this email. Sign in instead.';
    case 'auth/weak-password':
      return 'Choose a password with at least 6 characters.';
    case 'auth/network-request-failed':
      return 'Please check your internet connection and try again.';
    default:
      return 'We could not complete your request. Please try again.';
  }
}

export default function AuthScreen() {
  const [isRegistering, setIsRegistering] = useState(false);
  const [role, setRole] = useState<UserRole>('customer');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      Alert.alert('Missing details', 'Enter your email and password to continue.');
      return;
    }

    setLoading(true);
    try {
      if (isRegistering) {
        const credential = await createUserWithEmailAndPassword(
          auth,
          normalizedEmail,
          password,
        );
        await setDoc(doc(db, 'users', credential.user.uid), {
          email: normalizedEmail,
          role,
          createdAt: serverTimestamp(),
        });
      } else {
        await signInWithEmailAndPassword(auth, normalizedEmail, password);
      }
      router.replace('/(tabs)/home');
    } catch (error) {
      Alert.alert(
        isRegistering ? 'Account could not be created' : 'Sign in failed',
        getAuthErrorMessage(error),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen edges={['top', 'bottom', 'left', 'right']} style={styles.screen}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboard}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.brandMark}>
            <Ionicons name="shirt" size={33} color="#FFFFFF" />
          </View>
          <Text style={styles.brand}>Rentify</Text>
          <Text style={styles.subtitle}>
            {isRegistering
              ? 'Create an account to get started.'
              : 'A better way to wear something special.'}
          </Text>

          <View style={styles.form}>
            <Text style={styles.heading}>
              {isRegistering ? 'Create your account' : 'Welcome back'}
            </Text>
            <Text style={styles.description}>
              {isRegistering
                ? 'Join the Rentify community.'
                : 'Sign in to manage your rentals.'}
            </Text>

            {isRegistering ? (
              <View style={styles.roleGroup}>
                <Text style={styles.fieldLabel}>I am joining as</Text>
                <View style={styles.roleOptions}>
                  {(['customer', 'shop'] as const).map((option) => {
                    const selected = role === option;
                    return (
                      <Button
                        key={option}
                        title={option === 'shop' ? 'Shop' : 'Customer'}
                        variant={selected ? 'primary' : 'secondary'}
                        onPress={() => setRole(option)}
                        style={styles.roleButton}
                      />
                    );
                  })}
                </View>
              </View>
            ) : null}

            <TextField
              label="Email address"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              placeholder="you@example.com"
              returnKeyType="next"
            />
            <TextField
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete={isRegistering ? 'new-password' : 'current-password'}
              placeholder="At least 6 characters"
              returnKeyType="done"
              onSubmitEditing={submit}
            />
            <Button
              title={isRegistering ? 'Create account' : 'Sign in'}
              loading={loading}
              onPress={submit}
              style={styles.submit}
            />

            <View style={styles.switchRow}>
              <Text style={styles.switchText}>
                {isRegistering ? 'Already have an account?' : 'New to Rentify?'}
              </Text>
              <Text
                accessibilityRole="button"
                onPress={() => setIsRegistering((value) => !value)}
                style={styles.switchAction}
              >
                {isRegistering ? ' Sign in' : ' Create account'}
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    paddingHorizontal: 0,
  },
  keyboard: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 28,
  },
  brandMark: {
    alignSelf: 'center',
    width: 68,
    height: 68,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  brand: {
    textAlign: 'center',
    color: colors.text,
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 15,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 26,
  },
  form: {
    backgroundColor: colors.surface,
    borderRadius: 22,
    padding: 21,
    gap: 17,
    shadowColor: '#222842',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.07,
    shadowRadius: 20,
    elevation: 4,
  },
  heading: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
  },
  description: {
    color: colors.muted,
    fontSize: 14,
    marginTop: -12,
  },
  roleGroup: {
    gap: 8,
  },
  fieldLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  roleOptions: {
    flexDirection: 'row',
    gap: 10,
  },
  roleButton: {
    flex: 1,
  },
  submit: {
    marginTop: 2,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginTop: -3,
  },
  switchText: {
    color: colors.muted,
    fontSize: 14,
  },
  switchAction: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
});
