import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { signOut } from 'firebase/auth';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';

import { auth, db } from '../../../../firebaseConfig';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { colors } from '@/constants/rentify-theme';

export default function ShopProfileScreen() {
  const user = auth.currentUser;
  const [shopName, setShopName] = useState('');
  const [lateFeePerDay, setLateFeePerDay] = useState('');
  const [depositPolicy, setDepositPolicy] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(
      doc(db, 'users', user.uid),
      (snapshot) => {
        const data = snapshot.data();
        const policies = data?.policies;
        setShopName(typeof data?.shopName === 'string' ? data.shopName : '');
        setLateFeePerDay(
          policies && typeof policies.lateFeePerDay === 'number'
            ? String(policies.lateFeePerDay)
            : '',
        );
        setDepositPolicy(
          policies && typeof policies.depositPolicy === 'string'
            ? policies.depositPolicy
            : '',
        );
        setLoading(false);
      },
      (error) => {
        console.error('Could not load shop profile:', error);
        setLoading(false);
        Alert.alert('Profile unavailable', 'We could not load your shop details.');
      },
    );
  }, [user]);

  const savePolicies = async () => {
    if (!user) return;
    const fee = lateFeePerDay.trim() ? Number(lateFeePerDay) : 0;
    if (!Number.isFinite(fee) || fee < 0) {
      Alert.alert('Check late fee', 'Enter a valid non-negative amount.');
      return;
    }
    setSaving(true);
    try {
      await setDoc(
        doc(db, 'users', user.uid),
        {
          shopName: shopName.trim(),
          policies: {
            lateFeePerDay: fee,
            depositPolicy: depositPolicy.trim(),
          },
        },
        { merge: true },
      );
      Alert.alert('Policies saved', 'Your shop information has been updated.');
    } catch (error) {
      console.error('Could not save shop policies:', error);
      Alert.alert('Policies not saved', 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const logout = async () => {
    setSigningOut(true);
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Could not sign out shop owner:', error);
      Alert.alert('Sign out failed', 'Please try again.');
      setSigningOut(false);
    }
  };

  return (
    <Screen style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View>
          <Text style={styles.eyebrow}>SHOP SETTINGS</Text>
          <Text style={styles.title}>Profile</Text>
          <Text style={styles.subtitle}>Manage your shop and rental policies.</Text>
        </View>

        <Card style={styles.accountCard}>
          <View style={styles.avatar}>
            <Ionicons name="storefront-outline" size={28} color={colors.primary} />
          </View>
          <View style={styles.accountInfo}>
            <Text style={styles.accountLabel}>SHOP OWNER</Text>
            <Text style={styles.accountEmail}>{user?.email ?? 'Email unavailable'}</Text>
          </View>
        </Card>

        <Card style={styles.form}>
          <Text style={styles.sectionTitle}>Shop information</Text>
          <TextField
            label="Shop name"
            value={shopName}
            onChangeText={setShopName}
            placeholder="Your shop name"
            maxLength={70}
          />
          <Text style={styles.sectionTitle}>Rental policies</Text>
          <TextField
            label="Late fee per day (₱)"
            value={lateFeePerDay}
            onChangeText={setLateFeePerDay}
            placeholder="200"
            keyboardType="decimal-pad"
          />
          <TextField
            label="Deposit policy"
            value={depositPolicy}
            onChangeText={setDepositPolicy}
            placeholder="Explain when deposits are refunded"
            multiline
            textAlignVertical="top"
            style={styles.policyInput}
          />
          {loading ? <ActivityIndicator color={colors.primary} /> : null}
          <Button title="Save shop details" loading={saving} onPress={savePolicies} />
        </Card>

        <Button
          title="Log out"
          variant="secondary"
          icon="log-out-outline"
          loading={signingOut}
          onPress={logout}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 17 },
  content: { paddingTop: 21, paddingBottom: 25, gap: 13 },
  eyebrow: { color: colors.primary, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  title: { color: colors.text, fontSize: 27, fontWeight: '800', marginTop: 4 },
  subtitle: { color: colors.muted, fontSize: 13, marginTop: 4 },
  accountCard: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: colors.lavender,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  accountInfo: { flex: 1, gap: 5 },
  accountLabel: { color: colors.muted, fontSize: 10, fontWeight: '800', letterSpacing: 0.7 },
  accountEmail: { color: colors.text, fontSize: 13, fontWeight: '600' },
  form: { gap: 15 },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  policyInput: { minHeight: 90, paddingTop: 12 },
});
