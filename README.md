# E-Okul VBS — Veli Bilgilendirme Sistemi (demo)

Bu ZIP yalnızca veli portalını içerir. Öğretmen + YBS uygulamasından ayrı çalışır, ancak ikisi de aynı Firebase projesine bağlanmalıdır. Öğrenci adları ve okul numaraları demo amaçlı kurgusaldır; bu uygulama resmi MEB E-Okul sistemine bağlı değildir.

## Kurulum

1. Firebase Console'da `ambul-b4bd0` projesinde Authentication → Sign-in method altında **Email/Password** sağlayıcısını etkinleştirin ve Firestore Database'i oluşturun.
2. `.env.example` dosyasını `.env` olarak kopyalayın. `VITE_FIREBASE_API_KEY` değerine Firebase Web config'inizdeki `apiKey` değerini yapıştırın. Diğer Firebase config alanları `src/firebase.js` içinde ayarlıdır.
3. `firestore.rules` ve `firestore.indexes.json` dosyaları her iki ZIP'te de aynıdır. Kuralları yönetici hesabıyla bir kez yayınlayın:

   ```bash
   npm install -g firebase-tools
   firebase login
   firebase use --add
   # ambul-b4bd0 projesini seçin
   firebase deploy --only firestore:rules,firestore:indexes
   ```

4. Firebase Authentication → Users bölümünden veli hesabını oluşturun. Oluşturulan UID ile Firestore'da `users/{VELI_UID}` belgesini ekleyin:

   ```json
   {
     "role": "vbs",
     "displayName": "Demo Veli",
     "email": "veli@ornek.com"
   }
   ```

   UID, belge kimliğiyle birebir aynı olmalıdır. Bu profil uygulama içinden oluşturulmaz; rolü yönetici atar.

5. **Öğretmen + YBS ZIP'ini** çalıştırın, YBS hesabıyla **Öğrenci / Veli Bağla** ekranına gidin ve bu veli hesabının UID'sini ilgili öğrenciye bağlayın. Veli, eşleştirme yapılmadan öğrenci kaydı göremez.

## Çalıştırma

```bash
npm install
npm run dev
```

Terminalde gösterilen yerel adresi açın ve veli hesabıyla giriş yapın. Devamsızlık ve notlar Firestore'dan canlı dinlenir; veli portalı salt okunurdur. Öğretmenin kaydettiği var/yok işareti ve YBS'nin özürlü/özürsüz kararı aynı öğrenci kartında gösterilir. Sınav ve sözlü notları dönem ve değerlendirme numarasıyla listelenir.

## Gizlilik ve yetkiler

Firestore kuralları VBS hesabının yalnızca `parentUid` alanıyla kendisine bağlanmış öğrenci kaydını ve o öğrencinin alt koleksiyonlarını okumasına izin verir. Not ve yoklama yazma yetkisi verilmez. Firebase Web `apiKey` tek başına gizli bilgi değildir; veri güvenliği Authentication ve Firestore Security Rules ile sağlanır. Kuralları yayınlamadan gerçek öğrenci verisi kullanmayın.
