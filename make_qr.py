#!/usr/bin/env python3
"""Write a QR code PNG for the poster web page.  Usage: make_qr.py <url> [out.png]"""
import sys, qrcode
url = sys.argv[1]; out = sys.argv[2] if len(sys.argv) > 2 else '/scratch/user/soniyuvraj/MACE_SPAN/62-aiche_poster/assets/qr_site.png'
q = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=20, border=2); q.add_data(url); q.make(fit=True)
img = q.make_image(fill_color='#2d2360', back_color='white'); img.save(out); print(out, img.size, url)
