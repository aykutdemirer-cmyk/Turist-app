/**
 * Kullanım Şartları, Topluluk Kuralları ve Gizlilik Politikası — uygulama içi ekran ve herkese açık web sayfası
 * aynı metni kullanır. Bu bir TASLAKTIR: yayından önce bir hukukçuya gözden geçirtilmelidir.
 * Metin TR ve EN olarak tutulur; diğer arayüz dillerinde İngilizce gösterilir.
 */

export type LegalDocId = 'terms' | 'privacy';
export type LegalLocale = 'tr' | 'en';

export interface LegalSection {
  heading: string;
  paragraphs: string[];
}

export interface LegalDoc {
  title: string;
  updated: string;
  sections: LegalSection[];
}

const UPDATED = '2026-09-24';

export function legalDocument(id: LegalDocId, locale: LegalLocale, contactEmail: string): LegalDoc {
  const docs: Record<LegalDocId, Record<LegalLocale, LegalDoc>> = {
    terms: {
      tr: {
        title: 'Kullanım Şartları ve Topluluk Kuralları',
        updated: UPDATED,
        sections: [
          {
            heading: '1. Hizmet',
            paragraphs: [
              'LocalBite; sokak lezzetleri ve esnaf lokantaları için bir rehberdir, sipariş veya ödeme almaz. Mekan bilgileri, fiyatlar ve çalışma saatleri yaklaşıktır ve değişebilir.',
            ],
          },
          {
            heading: '2. Hesap',
            paragraphs: [
              'Yorum, gönderi ve yanıt paylaşmak için hesap gerekir. Hesabınızın güvenliğinden siz sorumlusunuz. Hesabınızı dilediğiniz an Profil › Güvenlik ve Gizlilik bölümünden silebilirsiniz.',
            ],
          },
          {
            heading: '3. Topluluk Kuralları — sıfır tolerans',
            paragraphs: [
              'Aşağıdaki içerikler kesinlikle yasaktır ve fark edildiği ya da şikayet edildiği anda kaldırılır:',
              '• Nefret söylemi; ırk, etnik köken, din, cinsiyet, cinsel yönelim, engellilik veya yaş temelli aşağılama',
              '• Küfür, hakaret, taciz, tehdit ve zorbalık',
              '• Cinsel içerik, şiddet ve yasa dışı faaliyetlerin teşviki',
              '• Spam, reklam, sahte veya yanıltıcı yorum ve kişisel bilgilerin (adres, telefon vb.) paylaşılması',
              'Kurallara uymayan içerikler en geç 24 saat içinde incelenir ve kaldırılır; ihlali tekrarlayan hesaplar kalıcı olarak kapatılır.',
            ],
          },
          {
            heading: '4. Şikayet ve engelleme',
            paragraphs: [
              'Her gönderi, yanıt ve yorumun "…" menüsünden içeriği şikayet edebilir veya yazarını engelleyebilirsiniz. Engellediğiniz kişinin içerikleri size artık gösterilmez.',
            ],
          },
          {
            heading: '5. İçerik hakları',
            paragraphs: [
              'Paylaştığınız içeriğin sorumluluğu size aittir. İçeriğinizi LocalBite içinde göstermemiz için bize münhasır olmayan, ücretsiz bir kullanım izni verirsiniz; hesabınızı sildiğinizde içerikleriniz de silinir.',
            ],
          },
          { heading: '6. İletişim', paragraphs: [`Sorular ve şikayetler için: ${contactEmail}`] },
        ],
      },
      en: {
        title: 'Terms of Use & Community Guidelines',
        updated: UPDATED,
        sections: [
          {
            heading: '1. The service',
            paragraphs: [
              'LocalBite is a guide to street food and local canteens; it does not take orders or payments. Venue details, prices and opening hours are approximate and may change.',
            ],
          },
          {
            heading: '2. Your account',
            paragraphs: [
              'You need an account to post reviews, community posts and replies. You are responsible for keeping it secure. You can delete your account at any time under Profile › Security & Privacy.',
            ],
          },
          {
            heading: '3. Community Guidelines — zero tolerance',
            paragraphs: [
              'The following content is strictly prohibited and is removed as soon as it is found or reported:',
              '• Hate speech; demeaning people based on race, ethnicity, religion, gender, sexual orientation, disability or age',
              '• Profanity, insults, harassment, threats and bullying',
              '• Sexual content, violence, or promotion of illegal activity',
              '• Spam, advertising, fake or misleading reviews, and sharing personal information (addresses, phone numbers, etc.)',
              'Reported content is reviewed and removed within 24 hours; accounts that repeatedly break these rules are permanently banned.',
            ],
          },
          {
            heading: '4. Reporting and blocking',
            paragraphs: [
              'Use the "…" menu on any post, reply or review to report the content or block its author. You will no longer see content from people you block.',
            ],
          },
          {
            heading: '5. Your content',
            paragraphs: [
              'You are responsible for what you post. You grant LocalBite a non-exclusive, royalty-free licence to display it in the app; your content is deleted when you delete your account.',
            ],
          },
          { heading: '6. Contact', paragraphs: [`Questions and complaints: ${contactEmail}`] },
        ],
      },
    },
    privacy: {
      tr: {
        title: 'Gizlilik Politikası',
        updated: UPDATED,
        sections: [
          {
            heading: 'Topladığımız veriler',
            paragraphs: [
              '• Hesap: ad, e-posta, (Google/GitHub ile girişte) profil fotoğrafı; şifreler geri döndürülemez biçimde saklanır.',
              '• Paylaşımlarınız: yorumlar, gönderiler, yanıtlar, beğeniler, şikayetler ve engellemeler.',
              '• Konum: yalnızca uygulama açıkken, size yakın mekanları göstermek için kullanılır ve sunucuya kaydedilmez. "Bugün burada gördüm" teyidi verdiğinizde, mekana yakınlığı doğrulamak için o anki konum teyitle birlikte saklanır.',
              '• Cihaz kimliği: misafir kullanımda teyit ve önerileri ilişkilendirmek için rastgele bir kimlik.',
              'Arka planda konum toplanmaz; reklam veya izleme amaçlı veri paylaşımı yapılmaz.',
            ],
          },
          {
            heading: 'Haklarınız (KVKK / GDPR)',
            paragraphs: [
              'Verilerinize erişme, düzeltme ve silme hakkınız vardır. Hesabınızı ve tüm verilerinizi uygulamada Profil › Güvenlik ve Gizlilik › "Hesabımı ve Tüm Verilerimi Sil" ile anında silebilirsiniz. Uygulamaya erişemiyorsanız web üzerindeki silme talebi formunu kullanabilirsiniz.',
            ],
          },
          { heading: 'İletişim', paragraphs: [`Veri sorumlusu iletişim: ${contactEmail}`] },
        ],
      },
      en: {
        title: 'Privacy Policy',
        updated: UPDATED,
        sections: [
          {
            heading: 'What we collect',
            paragraphs: [
              '• Account: name, email and (for Google/GitHub sign-in) profile photo; passwords are stored as irreversible hashes.',
              '• What you share: reviews, posts, replies, likes, reports and blocks.',
              '• Location: used only while the app is open, to show nearby spots, and not stored on our servers. When you confirm "I saw it here today", your location at that moment is stored with the confirmation to verify you were nearby.',
              '• Device ID: a random identifier linking guest confirmations and suggestions.',
              'We never collect location in the background and never share data for advertising or tracking.',
            ],
          },
          {
            heading: 'Your rights (GDPR / KVKK)',
            paragraphs: [
              'You can access, correct and delete your data. Delete your account and all data instantly in the app under Profile › Security & Privacy › "Delete my account and all data". If you cannot access the app, use the web deletion request form.',
            ],
          },
          { heading: 'Contact', paragraphs: [`Data controller contact: ${contactEmail}`] },
        ],
      },
    },
  };
  return docs[id][locale];
}
