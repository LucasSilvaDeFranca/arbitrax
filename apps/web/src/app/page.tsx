import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="max-w-2xl text-center">
        <h1 className="text-5xl font-bold text-primary-700 mb-4">ArbitraX</h1>
        <p className="text-xl text-gray-600 mb-8">
          Arbitragem virtual, acessivel e rapida — direto no seu WhatsApp.
        </p>
        <p className="text-gray-500 mb-12">
          Resolva conflitos de R$ 5.000 a R$ 1.000.000 em 15 a 45 dias, com validade juridica
          garantida pela Lei 9.307/96.
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/login"
            className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition font-medium"
          >
            Entrar
          </Link>
          <Link
            href="/register"
            className="px-6 py-3 border border-primary-600 text-primary-600 rounded-lg hover:bg-primary-50 transition font-medium"
          >
            Cadastrar
          </Link>
        </div>
      </div>
    </main>
  );
}
