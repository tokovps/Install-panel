export default {
  id: 'topup',
  render: async (user) => {
    const text = `
📥 <b>Top Up Saldo - Pilih Nominal</b>

Sistem top up menggunakan QRIS otomatis (AutoGoPay). Saldo akan langsung masuk beberapa detik setelah Anda melakukan pembayaran.

Silakan pilih salah satu nominal cepat di bawah ini atau klik <b>Jumlah Kustom</b> untuk memasukkan nominal sendiri:
`;

    const buttons = [
      [
        ['Rp 5.000', 'topup:pay:5000'],
        ['Rp 10.000', 'topup:pay:10000']
      ],
      [
        ['Rp 20.000', 'topup:pay:20000'],
        ['Rp 50.000', 'topup:pay:50000']
      ],
      [
        ['Rp 100.000', 'topup:pay:100000'],
        ['✏️ Jumlah Kustom', 'topup:custom']
      ]
    ];

    return {
      text,
      keyboard: buttons
    };
  }
};
