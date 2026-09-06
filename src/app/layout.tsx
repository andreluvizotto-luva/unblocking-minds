import "./globals.css";

export const metadata = {
  title: "+Unblocking",
  description: "Prática diária de inglês, calibrada ao seu nível, pela Unblocking Minds",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Poppins:wght@500;600;700;800&family=Caveat:wght@600;700&family=Work+Sans:wght@400;500;600&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
