import Head from 'next/head'

export default function Home() {
  return (
    <>
      <Head>
        <title>Strudel</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <main className="flex min-h-screen items-center justify-center bg-gray-100">
        <h1 className="text-4xl font-bold text-gray-800">Welcome to Strudel</h1>
      </main>
    </>
  )
} 