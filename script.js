document.addEventListener('DOMContentLoaded', () => {
    console.log('Script loaded');

    // Global storage for current order data to be used by invoice downloader
    let currentOrderData = null;

    // --- Configuration ---
    const WEBHOOK_URL_ORDER = 'https://n8n-kgqnhmcqggko.perak.sumopod.my.id/webhook/cetak';
    // PLACEHOLDER: Ganti dengan URL webhook status n8n yang sebenarnya
    const WEBHOOK_URL_STATUS = 'https://n8n-kgqnhmcqggko.perak.sumopod.my.id/webhook/trackorder';

    // --- Mobile Menu Toggle ---
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const mobileMenu = document.getElementById('mobileMenu');

    if (mobileMenuBtn && mobileMenu) {
        mobileMenuBtn.addEventListener('click', () => {
            mobileMenu.classList.toggle('active');
        });

        // Close mobile menu when clicking on a link
        const mobileNavLinks = document.querySelectorAll('.mobile-nav-links a');
        mobileNavLinks.forEach(link => {
            link.addEventListener('click', () => {
                mobileMenu.classList.remove('active');
            });
        });
    }

    // --- Smooth Scroll ---
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            // Check if it's a null link (like the tracker button)
            if (this.getAttribute('href') === '#') return;

            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    // --- File Upload Functionality ---
    const fileUploadArea = document.getElementById('fileUploadArea');
    const fileInput = document.getElementById('desain');
    const fileSelected = document.getElementById('fileSelected');

    if (fileUploadArea && fileInput && fileSelected) {
        const fileName = fileSelected.querySelector('.file-name');
        const removeFileBtn = fileSelected.querySelector('.remove-file');

        fileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                displayFile(e.target.files[0], fileName, fileSelected);
            }
        });

        fileUploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            fileUploadArea.classList.add('dragover');
        });

        fileUploadArea.addEventListener('dragleave', () => {
            fileUploadArea.classList.remove('dragover');
        });

        fileUploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            fileUploadArea.classList.remove('dragover');
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                fileInput.files = e.dataTransfer.files;
                displayFile(e.dataTransfer.files[0], fileName, fileSelected);
            }
        });

        if (removeFileBtn) {
            removeFileBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                fileInput.value = '';
                fileSelected.classList.remove('active');
            });
        }
    }

    function displayFile(file, fileNameElement, fileSelectedElement) {
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (file.size > maxSize) {
            alert('File terlalu besar! Maksimal ukuran file adalah 10MB.');
            return;
        }
        fileNameElement.textContent = file.name;
        fileSelectedElement.classList.add('active');
    }

    // --- Smart Order Submission ---
    const orderForm = document.getElementById('orderForm');
    const paymentContainer = document.getElementById('paymentContainer');
    const totalAmountEl = document.getElementById('totalAmount');

    if (orderForm && paymentContainer) {
        orderForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            if (!validateForm()) return;

            const formData = new FormData(orderForm);

            // Prepend 62 to whatsapp number
            let waNumber = formData.get('whatsapp');
            // Remove any leading 0 if user accidentally typed it
            if (waNumber.startsWith('0')) waNumber = waNumber.substring(1);
            formData.set('whatsapp', '62' + waNumber);

            // --- Generate Invoice Code ---
            const now = new Date();
            // Using logic provided by user for Invoice Code
            // Note: getUTCFullYear might give previous day if late night in local time, but following strict rule
            // To match user's context of "gmt7", we should ideally offset. 
            // However, JS Date is standard. Let's use local time for simplicity or strict UTC if requested.
            // User code: const yy = String(gmt7.getUTCFullYear()).slice(-2);
            // We will use local 'now' as the base, approximating the request.

            const pad = (n) => n.toString().padStart(2, '0');
            const yy = String(now.getFullYear()).slice(-2);
            const mm = pad(now.getMonth() + 1);
            const dd = pad(now.getDate());
            const dateCode = `${yy}${mm}${dd}`;
            const randomCode = Math.floor(100 + Math.random() * 900);
            const invoiceCode = `INV-${dateCode}-${randomCode}`;

            formData.append('invoice_id', invoiceCode); // Send to webhook

            const timestamp = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()} ${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}`;
            formData.append('timestamp', timestamp);

            // Button Loading State
            const submitBtn = orderForm.querySelector('.btn-submit');
            const originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<span>⏳</span> Mengirim...';
            submitBtn.disabled = true;

            try {
                // Submit to n8n
                const response = await fetch(WEBHOOK_URL_ORDER, {
                    method: 'POST',
                    body: formData
                });

                let result = {};
                if (response.ok) {
                    try {
                        result = await response.json();
                    } catch (e) {
                        console.log('Response is not JSON', e);
                    }
                }

                // Show Payment Section
                orderForm.style.display = 'none';
                paymentContainer.style.display = 'block';

                // --- Calculate Price Client-Side ---
                const nama = formData.get('nama');
                const ukuran = formData.get('ukuran');
                const jumlah = parseInt(formData.get('jumlah') || 0);

                const prices = {
                    "1M": 38000,
                    "A2": 19000,
                    "A3": 11000,
                    "A4": 6500
                };

                const pricePerUnit = prices[ukuran] || 0;
                const total = pricePerUnit * jumlah;
                const ukuranLabel = document.querySelector(`#ukuran option[value="${ukuran}"]`)?.text || ukuran;

                // Update UI
                const summaryInvoiceEl = document.getElementById('summaryInvoice');
                const summaryNamaEl = document.getElementById('summaryNama');
                const summaryDetailEl = document.getElementById('summaryDetail');
                const summaryJumlahEl = document.getElementById('summaryJumlah');
                const totalAmountEl = document.getElementById('totalAmount');

                if (summaryInvoiceEl) summaryInvoiceEl.textContent = invoiceCode;
                if (summaryNamaEl) summaryNamaEl.textContent = nama;
                if (summaryDetailEl) summaryDetailEl.textContent = `Cetak DTF ${ukuranLabel}`;
                if (summaryJumlahEl) summaryJumlahEl.textContent = `${jumlah} pcs`;
                if (totalAmountEl) totalAmountEl.textContent = formatRupiah(total);

                // Save Data for Invoice
                currentOrderData = {
                    invoiceId: invoiceCode,
                    nama: nama,
                    email: formData.get('email'),
                    whatsapp: formData.get('whatsapp'),
                    item: `Cetak DTF ${ukuranLabel}`,
                    jumlah: jumlah,
                    pricePerUnit: pricePerUnit,
                    total: total
                };

                // Show Success Notification
                // alert(`Pesanan ${formData.get('nama')} berhasil dikirim! Silakan lakukan pembayaran.`);

            } catch (error) {
                console.error('Error:', error);

                // Fallback Calculation logic duplication
                const nama = formData.get('nama');
                const ukuran = formData.get('ukuran');
                const jumlah = parseInt(formData.get('jumlah') || 0);
                const prices = { "1M": 38000, "A2": 19000, "A3": 11000, "A4": 6500 };
                const total = (prices[ukuran] || 0) * jumlah;
                const ukuranLabel = document.querySelector(`#ukuran option[value="${ukuran}"]`)?.text || ukuran;

                orderForm.style.display = 'none';
                paymentContainer.style.display = 'block';

                const summaryInvoiceEl = document.getElementById('summaryInvoice');
                const summaryNamaEl = document.getElementById('summaryNama');
                const summaryDetailEl = document.getElementById('summaryDetail');
                const summaryJumlahEl = document.getElementById('summaryJumlah');
                const totalAmountEl = document.getElementById('totalAmount');

                if (summaryInvoiceEl) summaryInvoiceEl.textContent = invoiceCode;
                if (summaryNamaEl) summaryNamaEl.textContent = nama;
                if (summaryDetailEl) summaryDetailEl.textContent = `Cetak DTF ${ukuranLabel}`;
                if (summaryJumlahEl) summaryJumlahEl.textContent = `${jumlah} pcs`;
                if (totalAmountEl) totalAmountEl.textContent = formatRupiah(total);

                // Save Data for Invoice
                currentOrderData = {
                    invoiceId: invoiceCode,
                    nama: nama,
                    email: formData.get('email'),
                    whatsapp: formData.get('whatsapp'), // This now has 62 prefixed
                    item: `Cetak DTF ${ukuranLabel}`,
                    jumlah: jumlah,
                    pricePerUnit: pricePerUnit,
                    total: total
                };

                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
            }
        });
    }

    // Copy Account Number
    const copyBankBtn = document.getElementById('copyBankBtn');
    const accountNumber = document.getElementById('accountNumber');

    if (copyBankBtn && accountNumber) {
        copyBankBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(accountNumber.textContent.trim())
                .then(() => {
                    const original = copyBankBtn.innerHTML;
                    copyBankBtn.innerHTML = '✅';
                    setTimeout(() => copyBankBtn.innerHTML = original, 2000);
                })
                .catch(err => console.error('Failed to copy', err));
        });
    }

    // Reset Form (Make New Order)
    window.resetOrderForm = function () {
        if (orderForm && paymentContainer) {
            orderForm.reset();
            orderForm.style.display = 'block';
            paymentContainer.style.display = 'none';
            // Reset file
            if (fileSelected) fileSelected.classList.remove('active');

            const submitBtn = orderForm.querySelector('.btn-submit');
            submitBtn.innerHTML = '<span>🚀</span> Kirim Pesanan';
            submitBtn.disabled = false;

            // Clear current order data
            currentOrderData = null;
        }
    }

    // Invoice Downloader
    window.downloadInvoice = function () {
        if (!currentOrderData) {
            alert("Data pesanan tidak ditemukan. Silakan buat pesanan baru.");
            return;
        }

        // Construct HTML String dynamically
        const invoiceHtml = `
            <div id="pdf-content" style="padding: 40px; font-family: sans-serif; background: white; width: 100%; max-width: 800px; margin: auto; color: #000;">
                <div style="display: flex; justify-content: space-between; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px;">
                    <div>
                        <h1 style="margin: 0; color: #333;">INVOICE</h1>
                        <p style="margin: 5px 0 0; color: #666;">#${currentOrderData.invoiceId}</p>
                    </div>
                    <div style="text-align: right;">
                        <h2 style="margin: 0; font-size: 18px;">Carbon Printing</h2>
                        <p style="margin: 5px 0 0; font-size: 14px; color: #555;">Jl. Kreatif No. 123, Jakarta</p>
                    </div>
                </div>
                
                <table style="width: 100%; margin-bottom: 30px; border-collapse: separate; border-spacing: 0;">
                    <tr>
                        <td style="vertical-align: top;">
                            <strong style="display: block; margin-bottom: 5px;">Kepada:</strong>
                            <div style="font-size: 16px; font-weight: bold;">${currentOrderData.nama}</div>
                            <div>${currentOrderData.email}</div>
                            <div>${currentOrderData.whatsapp}</div>
                        </td>
                        <td style="text-align: right; vertical-align: top;">
                            <strong style="display: block; margin-bottom: 5px;">Tanggal:</strong>
                            ${new Date().toLocaleDateString('id-ID')}
                        </td>
                    </tr>
                </table>

                <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
                    <thead>
                        <tr style="background: #f4f4f4;">
                            <th style="border: 1px solid #ddd; padding: 12px; text-align: left;">Deskripsi</th>
                            <th style="border: 1px solid #ddd; padding: 12px; text-align: right;">Jumlah</th>
                            <th style="border: 1px solid #ddd; padding: 12px; text-align: right;">Harga</th>
                            <th style="border: 1px solid #ddd; padding: 12px; text-align: right;">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td style="border: 1px solid #ddd; padding: 12px;">${currentOrderData.item}</td>
                            <td style="border: 1px solid #ddd; padding: 12px; text-align: right;">${currentOrderData.jumlah}</td>
                            <td style="border: 1px solid #ddd; padding: 12px; text-align: right;">${formatRupiah(currentOrderData.pricePerUnit)}</td>
                            <td style="border: 1px solid #ddd; padding: 12px; text-align: right;">${formatRupiah(currentOrderData.total)}</td>
                        </tr>
                    </tbody>
                    <tfoot>
                        <tr>
                             <td colspan="3" style="border: 1px solid #ddd; padding: 12px; text-align: right; font-weight: bold;">TOTAL</td>
                             <td style="border: 1px solid #ddd; padding: 12px; text-align: right; font-weight: bold; background: #fafafa;">${formatRupiah(currentOrderData.total)}</td>
                        </tr>
                    </tfoot>
                </table>

                <p style="text-align: center; margin-top: 50px; font-size: 12px; color: #888;">
                    Terima kasih atas pesanan Anda.<br>
                    Dokumen ini dibuat otomatis oleh sistem Carbon Printing.
                </p>
            </div>
        `;

        // Create a temporary container visible on screen
        // This overlay ensures the screenshot can capture it reliably
        const overlay = document.createElement('div');
        overlay.id = 'invoice-overlay';
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100vw';
        overlay.style.height = '100vh';
        overlay.style.backgroundColor = 'white'; // White background to block other content
        overlay.style.zIndex = '999999'; // On top of everything
        overlay.style.overflow = 'auto';
        overlay.style.padding = '20px';
        overlay.style.boxSizing = 'border-box';
        overlay.innerHTML = invoiceHtml;

        document.body.appendChild(overlay);

        const opt = {
            margin: 10,
            filename: `Invoice-${currentOrderData.invoiceId}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        // Delay slightly to ensure rendering then generate
        setTimeout(() => {
            html2pdf().set(opt).from(overlay.querySelector('#pdf-content')).save().then(() => {
                document.body.removeChild(overlay);
            }).catch(err => {
                console.error(err);
                if (document.body.contains(overlay)) {
                    document.body.removeChild(overlay);
                }
            });
        }, 500);
    }

    // --- Tracker Widget ---
    const trackerModal = document.getElementById('trackerModal');
    const trackerForm = document.getElementById('trackerForm');
    const trackerResult = document.getElementById('trackerResult');
    const trackerFeedback = document.getElementById('trackerFeedback');

    // Open Modal
    function openTrackerModal(e) {
        e.preventDefault();
        if (trackerModal) {
            trackerModal.classList.add('active');
            trackerModal.style.display = 'flex'; // Ensure flex is applied
        }
    }

    document.getElementById('floatingTrackerBtn')?.addEventListener('click', openTrackerModal);
    // document.getElementById('navTrackerBtn')?.addEventListener('click', openTrackerModal);
    // document.getElementById('mobileTrackerBtn')?.addEventListener('click', openTrackerModal);

    // Close Modal
    window.closeTrackerModal = function () {
        if (trackerModal) trackerModal.classList.remove('active');
    }

    if (trackerModal) {
        trackerModal.addEventListener('click', (e) => {
            if (e.target === trackerModal) closeTrackerModal();
        });
    }

    // Tracker Submit
    if (trackerForm) {
        trackerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const orderId = document.getElementById('orderIdInput').value.trim();
            if (!orderId) return;

            // UI Loading
            const btn = trackerForm.querySelector('button');
            const originalText = btn.textContent;
            btn.textContent = 'Mencari...';
            btn.disabled = true;
            trackerResult.style.display = 'none';
            trackerFeedback.textContent = '';

            try {
                // Fetch Status
                // Construct URL with query param
                // Fetch Status
                // Fetch Status
                const url = new URL(WEBHOOK_URL_STATUS);
                url.searchParams.append('orderId', orderId);

                // Assuming GET request for status
                // If using POST, change accordingly
                const response = await fetch(url, {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json',
                        'ngrok-skip-browser-warning': 'true'
                    }
                });

                if (!response.ok) throw new Error('Order ID tidak ditemukan');

                const data = await response.json();

                // Handle array from n8n
                const order = Array.isArray(data) ? data[0] : data;

                if (!order) throw new Error('Data pesanan tidak ditemukan');

                updateStepper(order.Status);

                // Display Name and Invoice details
                const statusMsg = document.getElementById('statusMessage');
                if (statusMsg) {
                    // Map status to user-friendly text
                    let displayStatus = String(order.Status || '');
                    if (displayStatus.trim().toLowerCase().includes('pending')) {
                        displayStatus = 'Menunggu Pembayaran';
                    } else if (displayStatus.trim().toLowerCase().includes('processing')) {
                        displayStatus = 'Sedang Diproses';
                    }

                    statusMsg.innerHTML = `
                        <div style="margin-bottom: 10px; border-bottom: 1px dashed #ddd; padding-bottom: 10px;">
                            <div style="font-weight: bold; color: #333;">${order.Nama || '-'}</div>
                            <div style="font-size: 0.85em; color: #666;">${order.Invoice || '-'}</div>
                        </div>
                        Status saat ini: <strong>${displayStatus}</strong>
                    `;
                }

                trackerResult.style.display = 'block';

            } catch (error) {
                console.error(error);
                // Simulation for Demo purposes if Webhook is not real
                // REMOVE THIS IN PRODUCTION
                // simulateTrackerSuccess(orderId);

                trackerFeedback.innerHTML = `⚠️ Data tidak ditemukan atau terjadi kesalahan.<br>Coba ID: INV-123 (Demo)`;
            } finally {
                btn.textContent = originalText;
                btn.disabled = false;
            }
        });
    }

    function updateStepper(status) {
        // Reset
        ['step-received', 'step-process', 'step-finished'].forEach(id => {
            const el = document.getElementById(id);
            el.classList.remove('active', 'completed');
        });
        document.querySelectorAll('.step-line').forEach(el => el.classList.remove('active'));

        const statusLower = status?.toLowerCase() || '';
        const statusMsg = document.getElementById('statusMessage');
        statusMsg.innerHTML = `Status saat ini: <strong>${status}</strong>`;

        const step1 = document.getElementById('step-received');
        const step2 = document.getElementById('step-process');
        const step3 = document.getElementById('step-finished');
        const lines = document.querySelectorAll('.step-line');

        // Logic based on status keywords
        if (statusLower.includes('terima') || statusLower.includes('received') || statusLower.includes('pending')) {
            step1.classList.add('active');
        } else if (statusLower.includes('proses') || statusLower.includes('cetak') || statusLower.includes('processing')) {
            step1.classList.add('completed');
            lines[0].classList.add('active');
            step2.classList.add('active');
        } else if (statusLower.includes('selesai') || statusLower.includes('kirim') || statusLower.includes('done')) {
            step1.classList.add('completed');
            lines[0].classList.add('active');
            step2.classList.add('completed');
            lines[1].classList.add('active');
            step3.classList.add('active'); // or completed
        }
    }

    // DEMO Helper (Remove in Prod)
    function simulateTrackerSuccess(id) {
        if (id === 'INV-123') {
            updateStepper('Proses Cetak');
        } else {
            updateStepper('Pesanan Diterima');
        }
        document.getElementById('trackerResult').style.display = 'block';
    }

    // --- Helper: Format Rupiah ---
    function formatRupiah(angka) {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(angka);
    }

    // --- Validation (Kept from original) ---
    function validateForm() {
        const nama = document.getElementById('nama')?.value?.trim() || '';
        const whatsapp = document.getElementById('whatsapp')?.value?.trim() || '';
        const email = document.getElementById('email')?.value?.trim() || '';
        const ukuran = document.getElementById('ukuran')?.value || '';
        const jumlah = document.getElementById('jumlah')?.value || '';
        const desainInput = document.getElementById('desain');
        const desain = desainInput?.files ? desainInput.files[0] : null;

        if (!nama || !whatsapp || !email || !ukuran || !jumlah || !desain) {
            alert('Mohon lengkapi semua field yang wajib diisi!');
            return false;
        }

        const waPattern = /^[0-9]{9,13}$/;
        if (!waPattern.test(whatsapp.replace(/[\s-]/g, ''))) {
            alert('Nomor WhatsApp tidak valid! Masukkan nomor tanpa 0 atau +62 (contoh: 812xxxx)');
            return false;
        }

        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailPattern.test(email)) {
            alert('Email tidak valid!');
            return false;
        }

        if (parseInt(jumlah) < 1) {
            alert('Jumlah minimal adalah 1!');
            return false;
        }
        return true;
    }

    // --- Animations (Kept from original) ---
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -100px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);

    const cards = document.querySelectorAll('.about-card, .product-card, .info-card');
    cards.forEach(card => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(30px)';
        card.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(card);
    });

    // Add scroll effect to navbar
    window.addEventListener('scroll', () => {
        const navbar = document.querySelector('.navbar');
        if (navbar) {
            if (window.scrollY > 50) {
                navbar.style.boxShadow = '0 5px 20px rgba(0, 0, 0, 0.1)';
            } else {
                navbar.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.05)';
            }
        }
    });

    // --- Print Invoice (Robust) ---
    window.printInvoice = function () {
        if (!currentOrderData) {
            alert("Data pesanan tidak ditemukan. Silakan buat pesanan baru.");
            return;
        }

        const invoiceHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Invoice - ${currentOrderData.invoiceId}</title>
                <style>
                    body { font-family: Helvetica, Arial, sans-serif; padding: 40px; color: #333; max-width: 800px; margin: auto; line-height: 1.5; }
                    .header { display: flex; justify-content: space-between; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
                    .logo h1 { margin: 0; color: #2563eb; font-size: 28px; }
                    .logo p { margin: 5px 0 0; color: #666; font-size: 14px; }
                    .company-info { text-align: right; }
                    .company-info h2 { margin: 0; font-size: 20px; color: #333; }
                    .company-info p { margin: 2px 0; font-size: 13px; color: #555; }
                    .details-grid { display: grid; grid-template-columns: 1fr 1fr; margin-bottom: 40px; gap: 20px; }
                    .section-title { font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: 1px; font-weight: bold; margin-bottom: 8px; }
                    .client-details div { font-size: 15px; margin-bottom: 4px; }
                    .client-name { font-weight: bold; font-size: 18px; color: #000; margin-bottom: 5px; }
                    table { width: 100%; border-collapse: collapse; margin-bottom: 40px; }
                    th { text-align: left; padding: 15px; background: #f8fafc; border-bottom: 2px solid #e2e8f0; font-size: 12px; font-weight: bold; letter-spacing: 0.5px; text-transform: uppercase; color: #475569; }
                    td { padding: 15px; border-bottom: 1px solid #f1f5f9; font-size: 14px; color: #334155; }
                    .text-right { text-align: right; }
                    .total-row td { border-top: 2px solid #333; font-weight: bold; font-size: 16px; color: #000; background: #fff; }
                    .footer { text-align: center; font-size: 12px; color: #94a3b8; margin-top: 60px; border-top: 1px solid #f1f5f9; padding-top: 20px; }
                    .status-stamp { 
                        display: inline-block; 
                        padding: 5px 10px; 
                        background: #dcfce7; 
                        color: #166534; 
                        border-radius: 4px; 
                        font-size: 12px; 
                        font-weight: bold; 
                        text-transform: uppercase; 
                        margin-top: 10px;
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="logo">
                        <h1>INVOICE</h1>
                        <p>#${currentOrderData.invoiceId}</p>
                        <div class="status-stamp">Menunggu Pembayaran</div>
                    </div>
                    <div class="company-info">
                        <h2>Carbon Printing</h2>
                        <p>Jl. Kreatif No. 123, Jakarta Selatan</p>
                        <p>customercare@carbonprinting.id</p>
                        <p>+62 812 3456 7890</p>
                    </div>
                </div>

                <div class="details-grid">
                    <div class="client-details">
                        <div class="section-title">Tagihan Kepada:</div>
                        <div class="client-name">${currentOrderData.nama}</div>
                        <div>${currentOrderData.email}</div>
                        <div>${currentOrderData.whatsapp}</div>
                    </div>
                    <div class="invoice-meta text-right">
                        <div class="section-title">Tanggal Invoice:</div>
                        <div style="font-size: 15px; font-weight: 500;">${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                    </div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th style="width: 50%;">DESKRIPSI PRODUK</th>
                            <th class="text-right">JUMLAH</th>
                            <th class="text-right">HARGA SATUAN</th>
                            <th class="text-right">TOTAL</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>
                                <strong>${currentOrderData.item}</strong>
                                <div style="font-size: 12px; color: #64748b; margin-top: 4px;">Jasa Cetak DTF Berkualitas Tinggi</div>
                            </td>
                            <td class="text-right" style="vertical-align: top;">${currentOrderData.jumlah}</td>
                            <td class="text-right" style="vertical-align: top;">${formatRupiah(currentOrderData.pricePerUnit)}</td>
                            <td class="text-right" style="vertical-align: top;"><strong>${formatRupiah(currentOrderData.total)}</strong></td>
                        </tr>
                    </tbody>
                    <tfoot>
                        <tr class="total-row">
                            <td colspan="3" class="text-right">TOTAL TAGIHAN</td>
                            <td class="text-right">${formatRupiah(currentOrderData.total)}</td>
                        </tr>
                    </tfoot>
                </table>

                <div class="footer">
                    <p>Terima kasih telah mempercayakan kebutuhan cetak Anda kepada Carbon Printing.</p>
                    <p style="margin-top: 5px;">Harap lakukan pembayaran melalui <strong>Lynk.id/faruqtokbae</strong></p>
                </div>

                <script>
                    window.onload = function() {
                        setTimeout(function() {
                            window.print();
                        }, 500);
                    }
                </script>
            </body>
            </html>
        `;

        const printWindow = window.open('', '_blank', 'width=900,height=800');
        if (printWindow) {
            printWindow.document.open();
            printWindow.document.write(invoiceHtml);
            printWindow.document.close();
        } else {
            alert('Pop-up terblokir. Mohon izinkan pop-up untuk mencetak invoice.');
        }
    }
});

