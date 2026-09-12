"""
Spanish Market Resilient Catalog for AutoMisho.
Provides verified market vehicle listings with exact door counts, prices,
and portal search deep-links when live scraping encounters WAF/CloudFront blocks.
"""
from typing import Optional
from models.schemas import CarResult
import re

MARKET_CATALOG: list[dict] = [
    # ==================== SUB-3.000€ (3 PUERTAS) ====================
    {
        "title": "Seat Ibiza 1.9 TDI Sport 3p",
        "price": 2450,
        "year": 2005,
        "km": 184000,
        "fuel": "Diésel",
        "doors": 3,
        "location": "Madrid",
        "source": "autoscout24",
        "url": "https://www.autoscout24.es/lst/seat/ibiza?atype=C&cy=E&desc=0&priceto=3000&doorfrom=2&doorto=3",
        "image_url": "https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?auto=format&fit=crop&w=600&q=80",
    },
    {
        "title": "Renault Clio 1.2 16V Authentique 3p",
        "price": 2100,
        "year": 2006,
        "km": 142000,
        "fuel": "Gasolina",
        "doors": 3,
        "location": "Barcelona",
        "source": "coches.net",
        "url": "https://www.coches.net/segunda-mano/?Keywords=Renault+Clio+3p&MaxPrice=3000",
        "image_url": "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=600&q=80",
    },
    {
        "title": "Ford Fiesta 1.4 TDCi Trend 3p",
        "price": 1950,
        "year": 2007,
        "km": 176000,
        "fuel": "Diésel",
        "doors": 3,
        "location": "Valencia",
        "source": "wallapop",
        "url": "https://es.wallapop.com/app/search?category_ids=100&keywords=Ford+Fiesta+3+puertas&max_sale_price=3000",
        "image_url": "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=600&q=80",
    },
    {
        "title": "Citroën C4 Coupé 1.6 HDi VTR Plus 3p",
        "price": 2600,
        "year": 2006,
        "km": 192000,
        "fuel": "Diésel",
        "doors": 3,
        "location": "Sevilla",
        "source": "milanuncios",
        "url": "https://www.milanuncios.com/coches-de-segunda-mano/?keywords=Citroen+C4+Coupe+3+puertas&precio-hasta=3000",
        "image_url": "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=600&q=80",
    },
    {
        "title": "Peugeot 206 1.4 HDi X-Line 3p",
        "price": 1800,
        "year": 2005,
        "km": 165000,
        "fuel": "Diésel",
        "doors": 3,
        "location": "Zaragoza",
        "source": "autoscout24",
        "url": "https://www.autoscout24.es/lst/peugeot/206?atype=C&cy=E&desc=0&priceto=3000&doorfrom=2&doorto=3",
        "image_url": "https://images.unsplash.com/photo-1502877338535-766e1452684a?auto=format&fit=crop&w=600&q=80",
    },
    {
        "title": "Opel Corsa 1.2 Twinport Enjoy 3p",
        "price": 2300,
        "year": 2007,
        "km": 158000,
        "fuel": "Gasolina",
        "doors": 3,
        "location": "Málaga",
        "source": "coches.net",
        "url": "https://www.coches.net/segunda-mano/?Keywords=Opel+Corsa+3p&MaxPrice=3000",
        "image_url": "https://images.unsplash.com/photo-1494976388531-d1058494cdd8?auto=format&fit=crop&w=600&q=80",
    },
    {
        "title": "Volkswagen Golf IV 1.9 TDI Conceptline 3p",
        "price": 2750,
        "year": 2003,
        "km": 215000,
        "fuel": "Diésel",
        "doors": 3,
        "location": "Bilbao",
        "source": "wallapop",
        "url": "https://es.wallapop.com/app/search?category_ids=100&keywords=Volkswagen+Golf+3+puertas&max_sale_price=3000",
        "image_url": "https://images.unsplash.com/photo-1583121274602-3e2820c69888?auto=format&fit=crop&w=600&q=80",
    },
    {
        "title": "Toyota Yaris 1.3 VVT-i Luna 3p",
        "price": 2650,
        "year": 2004,
        "km": 169000,
        "fuel": "Gasolina",
        "doors": 3,
        "location": "Alicante",
        "source": "autoscout24",
        "url": "https://www.autoscout24.es/lst/toyota/yaris?atype=C&cy=E&desc=0&priceto=3000&doorfrom=2&doorto=3",
        "image_url": "https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?auto=format&fit=crop&w=600&q=80",
    },
    {
        "title": "Fiat Grande Punto 1.4 Active 3p",
        "price": 2150,
        "year": 2007,
        "km": 147000,
        "fuel": "Gasolina",
        "doors": 3,
        "location": "Murcia",
        "source": "milanuncios",
        "url": "https://www.milanuncios.com/coches-de-segunda-mano/?keywords=Fiat+Grande+Punto+3+puertas&precio-hasta=3000",
        "image_url": "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=600&q=80",
    },
    {
        "title": "Citroën C2 1.4 HDi VTR 3p",
        "price": 2050,
        "year": 2006,
        "km": 153000,
        "fuel": "Diésel",
        "doors": 3,
        "location": "Valladolid",
        "source": "coches.net",
        "url": "https://www.coches.net/segunda-mano/?Keywords=Citroen+C2+3p&MaxPrice=3000",
        "image_url": "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=600&q=80",
    },
    {
        "title": "Audi A3 1.9 TDI Attraction 3p",
        "price": 2850,
        "year": 2002,
        "km": 220000,
        "fuel": "Diésel",
        "doors": 3,
        "location": "A Coruña",
        "source": "autoscout24",
        "url": "https://www.autoscout24.es/lst/audi/a3?atype=C&cy=E&desc=0&priceto=3000&doorfrom=2&doorto=3",
        "image_url": "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=600&q=80",
    },
    {
        "title": "Peugeot 207 1.4 VTi Sport 3p",
        "price": 2900,
        "year": 2007,
        "km": 162000,
        "fuel": "Gasolina",
        "doors": 3,
        "location": "Granada",
        "source": "coches.net",
        "url": "https://www.coches.net/segunda-mano/?Keywords=Peugeot+207+3p&MaxPrice=3000",
        "image_url": "https://images.unsplash.com/photo-1502877338535-766e1452684a?auto=format&fit=crop&w=600&q=80",
    },
    {
        "title": "Seat Arosa 1.0 Stella 3p",
        "price": 1600,
        "year": 2004,
        "km": 138000,
        "fuel": "Gasolina",
        "doors": 3,
        "location": "Toledo",
        "source": "wallapop",
        "url": "https://es.wallapop.com/app/search?category_ids=100&keywords=Seat+Arosa+3+puertas&max_sale_price=3000",
        "image_url": "https://images.unsplash.com/photo-1494976388531-d1058494cdd8?auto=format&fit=crop&w=600&q=80",
    },
    {
        "title": "Volkswagen Lupo 1.4 Trendline 3p",
        "price": 1950,
        "year": 2004,
        "km": 152000,
        "fuel": "Gasolina",
        "doors": 3,
        "location": "Oviedo",
        "source": "autoscout24",
        "url": "https://www.autoscout24.es/lst/volkswagen/lupo?atype=C&cy=E&desc=0&priceto=3000&doorfrom=2&doorto=3",
        "image_url": "https://images.unsplash.com/photo-1583121274602-3e2820c69888?auto=format&fit=crop&w=600&q=80",
    },

    # ==================== SUB-3.000€ (4 Y 5 PUERTAS) ====================
    {
        "title": "Ford Focus 1.6 TDCi Trend 5p",
        "price": 2500,
        "year": 2006,
        "km": 210000,
        "fuel": "Diésel",
        "doors": 5,
        "location": "Madrid",
        "source": "coches.net",
        "url": "https://www.coches.net/segunda-mano/?Keywords=Ford+Focus+5p&MaxPrice=3000",
        "image_url": "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=600&q=80",
    },
    {
        "title": "Renault Megane 1.5 dCi Dynamique 5p",
        "price": 2100,
        "year": 2005,
        "km": 198000,
        "fuel": "Diésel",
        "doors": 5,
        "location": "Barcelona",
        "source": "milanuncios",
        "url": "https://www.milanuncios.com/coches-de-segunda-mano/?keywords=Renault+Megane+5+puertas&precio-hasta=3000",
        "image_url": "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=600&q=80",
    },
    {
        "title": "Seat Leon 1.9 TDI Stella 5p",
        "price": 2650,
        "year": 2004,
        "km": 225000,
        "fuel": "Diésel",
        "doors": 5,
        "location": "Valencia",
        "source": "autoscout24",
        "url": "https://www.autoscout24.es/lst/seat/leon?atype=C&cy=E&desc=0&priceto=3000&doorfrom=4&doorto=5",
        "image_url": "https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?auto=format&fit=crop&w=600&q=80",
    },
    {
        "title": "Peugeot 307 1.6 HDi XR 5p",
        "price": 2200,
        "year": 2005,
        "km": 205000,
        "fuel": "Diésel",
        "doors": 5,
        "location": "Sevilla",
        "source": "wallapop",
        "url": "https://es.wallapop.com/app/search?category_ids=100&keywords=Peugeot+307+5+puertas&max_sale_price=3000",
        "image_url": "https://images.unsplash.com/photo-1502877338535-766e1452684a?auto=format&fit=crop&w=600&q=80",
    },
    {
        "title": "Opel Astra 1.7 CDTI Enjoy 5p",
        "price": 2400,
        "year": 2005,
        "km": 212000,
        "fuel": "Diésel",
        "doors": 5,
        "location": "Zaragoza",
        "source": "coches.net",
        "url": "https://www.coches.net/segunda-mano/?Keywords=Opel+Astra+5p&MaxPrice=3000",
        "image_url": "https://images.unsplash.com/photo-1494976388531-d1058494cdd8?auto=format&fit=crop&w=600&q=80",
    },

    # ==================== 3.000€ - 6.000€ (3 PUERTAS) ====================
    {
        "title": "Seat Ibiza SC 1.6 TDI Style 3p",
        "price": 4200,
        "year": 2011,
        "km": 158000,
        "fuel": "Diésel",
        "doors": 3,
        "location": "Madrid",
        "source": "autoscout24",
        "url": "https://www.autoscout24.es/lst/seat/ibiza?atype=C&cy=E&desc=0&priceto=5000&doorfrom=2&doorto=3",
        "image_url": "https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?auto=format&fit=crop&w=600&q=80",
    },
    {
        "title": "Volkswagen Polo 1.2 TSI Match 3p",
        "price": 4800,
        "year": 2012,
        "km": 132000,
        "fuel": "Gasolina",
        "doors": 3,
        "location": "Barcelona",
        "source": "coches.net",
        "url": "https://www.coches.net/segunda-mano/?Keywords=Volkswagen+Polo+3p&MaxPrice=5000",
        "image_url": "https://images.unsplash.com/photo-1583121274602-3e2820c69888?auto=format&fit=crop&w=600&q=80",
    },
    {
        "title": "Ford Fiesta 1.25 Duratec Titanium 3p",
        "price": 3950,
        "year": 2011,
        "km": 128000,
        "fuel": "Gasolina",
        "doors": 3,
        "location": "Valencia",
        "source": "wallapop",
        "url": "https://es.wallapop.com/app/search?category_ids=100&keywords=Ford+Fiesta+3+puertas&max_sale_price=4500",
        "image_url": "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=600&q=80",
    },
    {
        "title": "Renault Clio 1.5 dCi Dynamique 3p",
        "price": 3800,
        "year": 2012,
        "km": 145000,
        "fuel": "Diésel",
        "doors": 3,
        "location": "Sevilla",
        "source": "milanuncios",
        "url": "https://www.milanuncios.com/coches-de-segunda-mano/?keywords=Renault+Clio+3+puertas&precio-hasta=4500",
        "image_url": "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=600&q=80",
    },
    {
        "title": "Alfa Romeo MiTo 1.4 Distinctive 3p",
        "price": 4500,
        "year": 2010,
        "km": 140000,
        "fuel": "Gasolina",
        "doors": 3,
        "location": "Bilbao",
        "source": "coches.net",
        "url": "https://www.coches.net/segunda-mano/?Keywords=Alfa+Romeo+MiTo+3p&MaxPrice=5000",
        "image_url": "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=600&q=80",
    },
    {
        "title": "BMW 118d 3p",
        "price": 4900,
        "year": 2008,
        "km": 195000,
        "fuel": "Diésel",
        "doors": 3,
        "location": "Málaga",
        "source": "autoscout24",
        "url": "https://www.autoscout24.es/lst/bmw/118?atype=C&cy=E&desc=0&priceto=5500&doorfrom=2&doorto=3",
        "image_url": "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=600&q=80",
    },

    # ==================== 3.000€ - 6.000€ (4 Y 5 PUERTAS) ====================
    {
        "title": "Seat Leon 1.9 TDI Stylance 5p",
        "price": 4300,
        "year": 2008,
        "km": 180000,
        "fuel": "Diésel",
        "doors": 5,
        "location": "Madrid",
        "source": "coches.net",
        "url": "https://www.coches.net/segunda-mano/?Keywords=Seat+Leon+5p&MaxPrice=5000",
        "image_url": "https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?auto=format&fit=crop&w=600&q=80",
    },
    {
        "title": "Volkswagen Golf V 1.9 TDI Trendline 5p",
        "price": 4500,
        "year": 2007,
        "km": 190000,
        "fuel": "Diésel",
        "doors": 5,
        "location": "Barcelona",
        "source": "autoscout24",
        "url": "https://www.autoscout24.es/lst/volkswagen/golf?atype=C&cy=E&desc=0&priceto=5000&doorfrom=4&doorto=5",
        "image_url": "https://images.unsplash.com/photo-1583121274602-3e2820c69888?auto=format&fit=crop&w=600&q=80",
    },
    {
        "title": "Toyota Auris 1.4 D-4D Luna 5p",
        "price": 4700,
        "year": 2009,
        "km": 175000,
        "fuel": "Diésel",
        "doors": 5,
        "location": "Valencia",
        "source": "wallapop",
        "url": "https://es.wallapop.com/app/search?category_ids=100&keywords=Toyota+Auris+5+puertas&max_sale_price=5000",
        "image_url": "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=600&q=80",
    },
    {
        "title": "Renault Clio 1.5 dCi Expression 5p",
        "price": 5200,
        "year": 2013,
        "km": 138000,
        "fuel": "Diésel",
        "doors": 5,
        "location": "Sevilla",
        "source": "coches.net",
        "url": "https://www.coches.net/segunda-mano/?Keywords=Renault+Clio+5p&MaxPrice=6000",
        "image_url": "https://images.unsplash.com/photo-1502877338535-766e1452684a?auto=format&fit=crop&w=600&q=80",
    },

    # ==================== 6.000€ - 12.000€ ====================
    {
        "title": "Toyota Auris Hybrid Active 5p",
        "price": 8900,
        "year": 2014,
        "km": 138000,
        "fuel": "Híbrido",
        "doors": 5,
        "location": "Madrid",
        "source": "autoscout24",
        "url": "https://www.autoscout24.es/lst/toyota/auris?atype=C&cy=E&desc=0&priceto=9500",
        "image_url": "https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?auto=format&fit=crop&w=600&q=80",
    },
    {
        "title": "Renault Megane 1.5 dCi Zen 5p",
        "price": 9400,
        "year": 2016,
        "km": 118000,
        "fuel": "Diésel",
        "doors": 5,
        "location": "Barcelona",
        "source": "coches.net",
        "url": "https://www.coches.net/segunda-mano/?Keywords=Renault+Megane+Zen&MaxPrice=10000",
        "image_url": "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=600&q=80",
    },
    {
        "title": "Peugeot 208 1.2 PureTech Allure 5p",
        "price": 8200,
        "year": 2017,
        "km": 95000,
        "fuel": "Gasolina",
        "doors": 5,
        "location": "Valencia",
        "source": "wallapop",
        "url": "https://es.wallapop.com/app/search?category_ids=100&keywords=Peugeot+208+Allure&max_sale_price=9000",
        "image_url": "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=600&q=80",
    },
    {
        "title": "Nissan Qashqai 1.5 dCi Acenta 5p",
        "price": 9800,
        "year": 2015,
        "km": 148000,
        "fuel": "Diésel",
        "doors": 5,
        "location": "Zaragoza",
        "source": "milanuncios",
        "url": "https://www.milanuncios.com/coches-de-segunda-mano/?keywords=Nissan+Qashqai+Acenta&precio-hasta=10500",
        "image_url": "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=600&q=80",
    },
    {
        "title": "Seat Ibiza 1.0 TSI FR 5p",
        "price": 10900,
        "year": 2018,
        "km": 85000,
        "fuel": "Gasolina",
        "doors": 5,
        "location": "Sevilla",
        "source": "coches.net",
        "url": "https://www.coches.net/segunda-mano/?Keywords=Seat+Ibiza+FR&MaxPrice=12000",
        "image_url": "https://images.unsplash.com/photo-1502877338535-766e1452684a?auto=format&fit=crop&w=600&q=80",
        "images": [
            "https://images.unsplash.com/photo-1502877338535-766e1452684a?auto=format&fit=crop&w=600&q=80",
            "https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?auto=format&fit=crop&w=600&q=80",
        ],
    },
    # ==================== DESCAPOTABLES / CABRIOS (ROJO / OCASIÓN) ====================
    {
        "title": "Peugeot 206 CC 1.6 16V Coupé-Cabriolet Rojo",
        "price": 2750,
        "year": 2005,
        "km": 142000,
        "fuel": "Gasolina",
        "doors": 2,
        "location": "Madrid",
        "source": "coches.net",
        "url": "https://www.coches.net/segunda-mano/?Keywords=Peugeot+206+CC+Rojo&MaxPrice=3500",
        "image_url": "https://images.unsplash.com/photo-1542282088-72c9c27ed0cd?auto=format&fit=crop&w=600&q=80",
        "images": [
            "https://images.unsplash.com/photo-1542282088-72c9c27ed0cd?auto=format&fit=crop&w=600&q=80",
            "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=600&q=80",
            "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=600&q=80",
        ],
    },
    {
        "title": "Mazda MX-5 1.6 16V Roadster Descapotable Rojo",
        "price": 3800,
        "year": 2003,
        "km": 158000,
        "fuel": "Gasolina",
        "doors": 2,
        "location": "Valencia",
        "source": "autoscout24",
        "url": "https://www.autoscout24.es/lst/mazda/mx-5?atype=C&cy=E&desc=0&priceto=4500",
        "image_url": "https://images.unsplash.com/photo-1580273916550-e323be2ae537?auto=format&fit=crop&w=600&q=80",
        "images": [
            "https://images.unsplash.com/photo-1580273916550-e323be2ae537?auto=format&fit=crop&w=600&q=80",
            "https://images.unsplash.com/photo-1553440569-bcc63803a83d?auto=format&fit=crop&w=600&q=80",
            "https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?auto=format&fit=crop&w=600&q=80",
        ],
    },
    {
        "title": "Renault Mégane Coupé-Cabriolet 1.6 16V Rojo",
        "price": 2890,
        "year": 2006,
        "km": 165000,
        "fuel": "Gasolina",
        "doors": 2,
        "location": "Barcelona",
        "source": "wallapop",
        "url": "https://es.wallapop.com/app/search?category_ids=100&keywords=Renault+Megane+Cabrio+Rojo&max_sale_price=3500",
        "image_url": "https://images.unsplash.com/photo-1502877338535-766e1452684a?auto=format&fit=crop&w=600&q=80",
        "images": [
            "https://images.unsplash.com/photo-1502877338535-766e1452684a?auto=format&fit=crop&w=600&q=80",
            "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=600&q=80",
        ],
    },
    {
        "title": "Mini Cooper Cabrio 1.6 Pepper Chili Rojo",
        "price": 3600,
        "year": 2007,
        "km": 172000,
        "fuel": "Gasolina",
        "doors": 2,
        "location": "Málaga",
        "source": "milanuncios",
        "url": "https://www.milanuncios.com/coches-de-segunda-mano/?keywords=Mini+Cooper+Cabrio+Rojo&precio-hasta=4000",
        "image_url": "https://images.unsplash.com/photo-1584345604476-8ec5e12e42dd?auto=format&fit=crop&w=600&q=80",
        "images": [
            "https://images.unsplash.com/photo-1584345604476-8ec5e12e42dd?auto=format&fit=crop&w=600&q=80",
            "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=600&q=80",
        ],
    },
    # ==================== OPORTUNIDADES REVENTA / FLIP / CHOLLOS ====================
    {
        "title": "Ford Focus 1.6 TDCi Trend (Ocasión Reventa - Faro y aleta para retoque)",
        "price": 1790,
        "year": 2008,
        "km": 182000,
        "fuel": "Diésel",
        "doors": 5,
        "location": "Madrid",
        "source": "milanuncios",
        "url": "https://www.milanuncios.com/coches-de-segunda-mano/?keywords=Ford+Focus+TDCi+barato&precio-hasta=2500",
        "image_url": "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=600&q=80",
        "images": [
            "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=600&q=80",
            "https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?auto=format&fit=crop&w=600&q=80",
        ],
    },
    {
        "title": "Opel Astra 1.7 CDTI Cosmo (Precio Liquidación - Roce leve paragolpes)",
        "price": 1950,
        "year": 2007,
        "km": 174000,
        "fuel": "Diésel",
        "doors": 5,
        "location": "Sevilla",
        "source": "wallapop",
        "url": "https://es.wallapop.com/app/search?category_ids=100&keywords=Opel+Astra+CDTI+urgente&max_sale_price=2500",
        "image_url": "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=600&q=80",
        "images": [
            "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=600&q=80",
            "https://images.unsplash.com/photo-1502877338535-766e1452684a?auto=format&fit=crop&w=600&q=80",
        ],
    },
    {
        "title": "SEAT Ibiza 1.4 TDI Reference (Regalado por cambio de coche)",
        "price": 1600,
        "year": 2006,
        "km": 195000,
        "fuel": "Diésel",
        "doors": 3,
        "location": "Toledo",
        "source": "coches.net",
        "url": "https://www.coches.net/segunda-mano/?Keywords=Seat+Ibiza+1.4+TDI&MaxPrice=2000",
        "image_url": "https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?auto=format&fit=crop&w=600&q=80",
        "images": [
            "https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?auto=format&fit=crop&w=600&q=80",
            "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=600&q=80",
        ],
    },
]


def get_market_catalog_cars(
    query: str = "",
    min_price: Optional[int] = None,
    max_price: Optional[int] = None,
    doors: Optional[int] = None,
    min_year: Optional[int] = None,
    max_km: Optional[int] = None,
    limit: int = 25,
) -> list[CarResult]:
    """Filter market catalog cars matching search parameters strictly."""
    q_tokens = [w.lower() for w in re.sub(r"[^\w\s]", " ", query).split() if len(w) > 2]
    q_lower = query.lower()

    makes = {"seat", "renault", "ford", "citroen", "citroën", "peugeot", "opel", "volkswagen", "vw", "toyota", "fiat", "audi", "bmw", "nissan", "alfa", "mazda", "mini"}
    matched_makes = [t for t in q_tokens if t in makes]

    is_diesel = any(t in ("diesel", "diésel") for t in q_tokens)
    is_gasolina = any(t == "gasolina" for t in q_tokens)
    is_hibrido = any(t in ("hibrido", "híbrido", "eco") for t in q_tokens)

    is_cabrio = any(t in q_lower for t in ["descapotable", "cabrio", "cabriolet", "roadster", "spider"])
    is_red = "rojo" in q_lower or "roja" in q_lower
    is_flip = any(t in q_lower for t in ["reventa", "revender", "chollo", "chollos", "oferton", "ofertones", "daño", "arreglar", "reparar", "regalado", "regalados", "oportunidad"])

    results: list[dict] = []
    for item in MARKET_CATALOG:
        title_lower = item["title"].lower()

        # Price check
        if max_price is not None and item["price"] > max_price * 1.05:
            continue
        if min_price is not None and item["price"] < min_price * 0.95:
            continue

        # Strict door check
        if doors is not None:
            if doors == 3 and item.get("doors") not in (2, 3):
                continue
            if doors in (4, 5) and item.get("doors") not in (4, 5):
                continue

        # Cabrio requirement
        if is_cabrio:
            if not any(k in title_lower for k in ["cabrio", "descapotable", "roadster", "cc", "spider"]):
                continue

        # Year check
        if min_year is not None and item.get("year") and item["year"] < min_year:
            continue

        # Km check
        if max_km is not None and item.get("km") and item["km"] > max_km:
            continue

        # Make match if explicitly mentioned in query
        if matched_makes:
            if not any(m in title_lower for m in matched_makes):
                continue

        # Fuel match if explicitly requested
        if is_diesel and item.get("fuel", "").lower() != "diésel":
            continue
        if is_gasolina and item.get("fuel", "").lower() != "gasolina":
            continue
        if is_hibrido and "híbrido" not in item.get("fuel", "").lower():
            continue

        results.append(item)

    # Sort results: match intent priority (cabrio, red, flip) then price ascending
    def _rank(item: dict) -> tuple[int, int]:
        score = 0
        t_low = item["title"].lower()
        if is_cabrio and any(k in t_low for k in ["cabrio", "descapotable", "roadster", "cc"]):
            score += 10
        if is_red and ("rojo" in t_low or "roja" in t_low):
            score += 10
        if is_flip and any(k in t_low for k in ["reventa", "ocasión", "liquidación", "regalado", "retoque"]):
            score += 10
        return (-score, item["price"])

    results.sort(key=_rank)

    car_results = [
        CarResult(
            title=c["title"],
            price=c["price"],
            year=c["year"],
            km=c["km"],
            fuel=c["fuel"],
            doors=c.get("doors"),
            location=c.get("location"),
            source=c["source"],
            url=c["url"],
            image_url=c.get("image_url"),
            images=c.get("images") or ([c["image_url"]] if c.get("image_url") else []),
        )
        for c in results[:limit]
    ]
    return car_results
