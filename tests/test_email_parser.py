"""Unit tests for BCP and Yape email transaction parser."""

import pytest

from src.services.email_parser import email_parser_service


@pytest.mark.asyncio
async def test_parse_bcp_card_debit():
    raw_email = """Estimado(a) Cliente:
Le informamos que se ha realizado una operación con su Tarjeta Credimás Débito BCP N° ...4921
Operación: Consumo
Comercio: RAPPI PERU
Importe: S/ 46.50
Fecha y hora: 26/09/2026 14:15:22
Canal: POS / Internet
Si no reconoce esta operación, comuníquese inmediatamente con nuestra Banca por Teléfono."""

    res = await email_parser_service.parse_email(
        raw_body=raw_email,
        sender="notificaciones@bcp.com.pe",
        subject="Constancia de Operación - Consumo",
    )

    assert res.is_transaction is True
    assert res.merchant == "RAPPI PERU"
    assert res.amount == 46.50
    assert res.currency == "PEN"
    assert res.parser_used == "regex_bcp_card"
    assert res.card_or_account == "Card ****4921"
    assert res.ext_transaction_id.startswith("bcp_card_")


@pytest.mark.asyncio
async def test_parse_bcp_card_usd():
    raw_email = """Hola SEBASTIAN,
Registramos un consumo con tu Tarjeta Visa Signature BCP terminada en 8812.
Establecimiento: APPLE.COM/BILL
Monto: US$ 14.99
Fecha y hora: 26/09/2026 16:30
Gracias por usar tus tarjetas BCP."""

    res = await email_parser_service.parse_email(
        raw_body=raw_email,
        sender="bancodecredito@bcp.com.pe",
        subject="Notificación de Consumo con Tarjeta BCP",
    )

    assert res.is_transaction is True
    assert res.merchant == "APPLE.COM/BILL"
    assert res.amount == 14.99
    assert res.currency == "USD"
    assert res.parser_used == "regex_bcp_card"
    assert res.card_or_account == "Card ****8812"


@pytest.mark.asyncio
async def test_parse_yape_sent():
    raw_email = """¡Yapeaste con éxito!
Enviaste dinero a: CEBICHERIA LA MAR SAC
Monto: S/ 78.00
Fecha: 26/09/2026 - 14:35
Nro. de Operación: 94810294
¡Gracias por yapear!"""

    res = await email_parser_service.parse_email(
        raw_body=raw_email,
        sender="notificaciones@yape.com.pe",
        subject="¡Yapeaste!",
    )

    assert res.is_transaction is True
    assert "CEBICHERIA LA MAR" in res.merchant
    assert res.amount == 78.00
    assert res.currency == "PEN"
    assert res.operation_type == "DEBIT"
    assert res.parser_used == "regex_yape"
    assert res.ext_transaction_id == "yape_94810294"


@pytest.mark.asyncio
async def test_parse_yape_received():
    raw_email = """¡Te yapearon!
Recibiste dinero de: CARLOS ALBERTO
Monto: S/ 120.00
Fecha: 26/09/2026 - 15:00
Nro. de Operación: 11002233
¡Yape te hace la vida más fácil!"""

    res = await email_parser_service.parse_email(
        raw_body=raw_email,
        sender="notificaciones@yape.com.pe",
        subject="¡Te yapearon!",
    )

    assert res.is_transaction is True
    assert "CARLOS ALBERTO" in res.merchant
    assert res.amount == 120.00
    assert res.currency == "PEN"
    assert res.operation_type == "CREDIT"
    assert res.parser_used == "regex_yape"
    assert res.ext_transaction_id == "yape_11002233"


@pytest.mark.asyncio
async def test_parse_bcp_transfer():
    raw_email = """Constancia de Operación
Detalle de la transferencia:
Cuenta Origen: Cuenta Sueldo BCP ...3019
Beneficiario: CLINICA SAN FELIPE
Importe: S/ 250.00
Fecha: 26/09/2026 a las 11:20
Número de operación: 00481920"""

    res = await email_parser_service.parse_email(
        raw_body=raw_email,
        sender="avisos@viabcp.com",
        subject="Constancia de Transferencia a Terceros BCP",
    )

    assert res.is_transaction is True
    assert "CLINICA SAN FELIPE" in res.merchant
    assert res.amount == 250.00
    assert res.currency == "PEN"
    assert res.parser_used == "regex_bcp_transfer"


@pytest.mark.asyncio
async def test_reject_newsletter():
    raw_email = """Estimado cliente,
Aprovecha este fin de semana hasta 50% de descuento en restaurantes seleccionados con tus tarjetas BCP.
Ingresa a nuestra web para conocer los términos y condiciones.
No responder a este correo."""

    res = await email_parser_service.parse_email(
        raw_body=raw_email,
        sender="promociones@bcp.com.pe",
        subject="¡Promoción exclusiva de fin de semana!",
    )

    assert res.is_transaction is False
    assert res.amount is None


@pytest.mark.asyncio
async def test_html_email_stripping():
    html_email = """
    <html>
        <body>
            <div style="font-family: Arial;">
                <h2>Constancia de Operación</h2>
                <p>Estimado cliente,</p>
                <table>
                    <tr><td>Comercio:</td><td><b>UBER RIDES PERU</b></td></tr>
                    <tr><td>Monto:</td><td>S/ 19.80</td></tr>
                    <tr><td>Tarjeta:</td><td>Credimás Débito ****5555</td></tr>
                    <tr><td>Fecha:</td><td>26/09/2026 12:00</td></tr>
                </table>
            </div>
        </body>
    </html>
    """

    res = await email_parser_service.parse_email(
        raw_body=html_email,
        sender="notificaciones@bcp.com.pe",
        subject="Constancia de Operación",
    )

    assert res.is_transaction is True
    assert "UBER" in res.merchant
    assert res.amount == 19.80


@pytest.mark.asyncio
async def test_parse_bcp_soles_with_dot():
    raw_email = """Estimado(a) Cliente:
Le informamos sobre su consumo con Tarjeta de Débito BCP ****9012
Comercio: METRO MIRAFLORES
Importe: S/. 135.40
Fecha: 25/09/2026 19:40:00"""

    res = await email_parser_service.parse_email(
        raw_body=raw_email,
        sender="notificaciones@notificacionesbcp.com.pe",
        subject="Aviso de Consumo BCP",
    )

    assert res.is_transaction is True
    assert res.merchant == "METRO MIRAFLORES"
    assert res.amount == 135.40
    assert res.currency == "PEN"
    assert res.card_or_account == "Card ****9012"


@pytest.mark.asyncio
async def test_parse_bcp_service_payment():
    raw_email = """Constancia de Pago de Servicios
Operación: Pago de Recibo
Empresa: SEDAPAL
Importe: S/ 84.50
Fecha y hora: 24/09/2026 10:15
N° Operación: 8941029"""

    res = await email_parser_service.parse_email(
        raw_body=raw_email,
        sender="avisos@viabcp.com",
        subject="Constancia de Pago de Servicios BCP",
    )

    assert res.is_transaction is True
    assert res.merchant == "SEDAPAL"
    assert res.amount == 84.50
    assert res.currency == "PEN"
    assert res.parser_used == "regex_bcp_service_payment"


@pytest.mark.asyncio
async def test_parse_spanish_textual_date():
    raw_email = """¡Yapeaste con éxito!
Enviaste a: PEDRO SANCHEZ
Monto: S/. 30.00
Fecha: 25 de setiembre de 2026 a las 14:20:00
Nro. de Operación: 55443322"""

    res = await email_parser_service.parse_email(
        raw_body=raw_email,
        sender="notificaciones@yape.com.pe",
        subject="¡Yapeaste!",
    )

    assert res.is_transaction is True
    assert "PEDRO SANCHEZ" in res.merchant
    assert res.amount == 30.00
    assert res.transaction_time.year == 2026
    assert res.transaction_time.month == 9
    assert res.transaction_time.day == 25


@pytest.mark.asyncio
async def test_parse_bbva_plin():
    raw_email = """Hola, SEBASTIAN
Plineaste S/ 2.62 a Sebastian A Peralta I
Detalles de tu plineo
Celular: •2814
Destino: Yape
ITF: S/ 0.00
Fecha y hora: 26 de setiembre, 2026 21:30
Número de operación: 85D6E2E24B9E"""

    res = await email_parser_service.parse_email(
        raw_body=raw_email,
        sender="procesos@bbva.com.pe",
        subject="Constancia de operación transferencia PLIN",
    )

    assert res.is_transaction is True
    assert "Sebastian A Peralta I" in res.merchant
    assert res.amount == 2.62
    assert res.currency == "PEN"
    assert res.parser_used == "regex_plin"
    assert res.ext_transaction_id == "plin_85D6E2E24B9E"
    assert res.transaction_time.hour == 2  # 21:30 Peru is 02:30 UTC next day


@pytest.mark.asyncio
async def test_parse_bcp_plin_consumption():
    raw_email = """Hola Sebastian Andre,
Realizaste un consumo de S/ 1.11 con tu Tarjeta de Débito BCP en PLIN-SEBASTIAN ANDRE PE.
Total del consumo : S/ 1.11
Fecha y hora : 26 de setiembre de 2026 - 09:28 PM
Número de Tarjeta de Débito : ************8590
Empresa : PLIN-SEBASTIAN ANDRE PE
Número de operación : 785657"""

    res = await email_parser_service.parse_email(
        raw_body=raw_email,
        sender="notificaciones@notificacionesbcp.com.pe",
        subject="Realizaste un consumo con tu Tarjeta de Débito BCP",
    )

    assert res.is_transaction is True
    assert res.merchant == "PLIN-SEBASTIAN ANDRE PE"
    assert res.amount == 1.11
    assert res.currency == "PEN"
    assert res.parser_used == "regex_bcp_card"
    assert res.card_or_account == "Card ****8590"
    assert res.ext_transaction_id == "bcp_785657"
    assert res.transaction_time.hour == 2  # 09:28 PM Peru is 02:28 UTC next day


@pytest.mark.asyncio
async def test_parse_falabella_cmr():
    raw_email = """Te informamos que se ha realizado un consumo con tu Tarjeta CMR, te adjuntamos el detalle:
Realizado por: Sebastian Andre Peralta Ib
Tarjeta: 447410******4422
Fecha: 26-setiembre-2026
Hora: 18:40
Comercio: Dlc Didi Pe Payin Rider Lima Pe
Monto: S/ 14.50
Número de operación: 626923981925"""

    res = await email_parser_service.parse_email(
        raw_body=raw_email,
        sender="notificaciones@pe.notificaciones.bancofalabella.com",
        subject="Notificación de Operaciones CMR",
    )

    assert res.is_transaction is True
    assert "Dlc Didi" in res.merchant
    assert res.amount == 14.50
    assert res.currency == "PEN"
    assert res.parser_used == "regex_falabella_cmr"
    assert res.card_or_account == "Card ****4422"
    assert res.ext_transaction_id == "cmr_626923981925"


@pytest.mark.asyncio
async def test_reject_wardadito_reminder():
    raw_email = """¡No te olvides! Tienes un débito automático pronto
Recuerda que tu aporte automático se realizará del 27 al 30 de cada mes
Ahorro Mensual
S/ 10.00
Para tu Wardadito
Asegurate de tener saldo en tu cuenta vinculada para seguir ahorrando juntos."""

    res = await email_parser_service.parse_email(
        raw_body=raw_email,
        sender="notificaciones@notificacionesbcp.com.pe",
        subject="¡No te olvides! Tienes un débito automático pronto",
    )

    assert res.is_transaction is False
    assert res.amount is None


@pytest.mark.asyncio
async def test_parse_bbva_card_consumption():
    raw_email = """BBVA
Hola, SEBASTIAN
Has realizado el siguiente consumo:
Comercio:
DLC*RAPPI PERU
Monto:
10.80
: Moneda:
PEN
Fecha:
22/09/2026
: Hora:
22:21:27
Este se cargará a tu tarjeta terminada en *4079"""

    res = await email_parser_service.parse_email(
        raw_body=raw_email,
        sender="procesos@bbva.com.pe",
        subject="Has realizado un consumo con tu tarjeta BBVA",
        email_id="1a0cc485ed57eef4",
    )

    assert res.is_transaction is True
    assert res.merchant == "DLC*RAPPI PERU"
    assert res.amount == 10.80
    assert res.currency == "PEN"
    assert res.parser_used == "regex_bbva_card"
    assert res.card_or_account == "Card ****4079"
    assert res.ext_transaction_id == "bbva_card_1a0cc485ed57eef4"
    assert res.transaction_time.hour == 3  # 22:21 Peru is 03:21 UTC next day


@pytest.mark.asyncio
async def test_parse_bbva_qr_payment():
    raw_email = """BBVA :
Hola, SEBASTIAN ANDRE
Has realizado con éxito la operación:
Pagar con QR
Importe pagado
S/ 16.00
DETALLES DE LA OPERACIÓN
Tipo de operación
Pagar con QR
Fecha de la operación
23 de septiembre, 2026
Comercio
IZI*MICHA MIRAFLORES
Forma de pago
VISA COMPRAS
Número de tarjeta
• 4079
ID de compra
d00b31ddd7404e8"""

    res = await email_parser_service.parse_email(
        raw_body=raw_email,
        sender="procesos@bbva.com.pe",
        subject="BBVA - Constancia de pago a comercios con QR",
        email_id="1a0d10c45db7f664",
    )

    # BBVA QR payment with VISA COMPRAS is skipped because the primary card consumption alert is also received
    assert res.is_transaction is False


@pytest.mark.asyncio
async def test_reject_yape_credit_disbursement():
    raw_email = """Hola Sebastian Andre,
El crédito que solicitaste ya se encuentra disponible en tu cuenta Yape. Aquí puedes ver el resumen.
Monto solicitado: S/ 150.00
TCEA (Costo efectivo): S/ 5.04
Total a pagar: S/ 155.04
Fecha de pago: 09 oct. 2026"""

    res = await email_parser_service.parse_email(
        raw_body=raw_email,
        sender="notificaciones@yape.pe",
        subject="Tu crédito ya está disponible en tu cuenta Yape",
        email_id="1a0ce41365d1ffa0",
    )

    assert res.is_transaction is False
    assert res.amount is None
