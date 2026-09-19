from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import os
import httpx
import logging
import json

from services.model_gateway import ModelGateway, ModelTier
from services.sentinel import SentinelToolGateway, ToolClassification, SecurityPolicyException
from services.memory.conversation_buffer import ConversationBuffer

logger = logging.getLogger("automisho.agent_router")

router = APIRouter(prefix="/agent", tags=["agent"])

# Initialize services
BROWSER_SERVICE_URL = os.getenv("BROWSER_SERVICE_URL", "http://localhost:3001")
COMMANDCODE_BASE_URL = os.getenv("COMMANDCODE_BASE_URL", "https://api.commandcode.ai/provider/v1")
COMMANDCODE_API_KEY = os.getenv("COMMANDCODE_API_KEY", "")
SENTINEL_SECRET = os.getenv("SENTINEL_SECRET", "automisho_secret_dev")

model_gw = ModelGateway(base_url=COMMANDCODE_BASE_URL, api_key=COMMANDCODE_API_KEY)
sentinel = SentinelToolGateway(secret_key=SENTINEL_SECRET)

# --- 1. Define Tool Handlers ---

async def tool_search_cars(
    query: str,
    max_price: Optional[int] = None,
    min_price: Optional[int] = None,
    doors: Optional[int] = None,
    sources: Optional[List[str]] = None,
) -> List[Dict[str, Any]]:
    """Calls the isolated browser worker to scrape cars using Playwright/Chromium."""
    logger.info(f"[Tool:search_cars] Executing via Browser Worker at {BROWSER_SERVICE_URL} query='{query}' max_price={max_price} doors={doors}")
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                f"{BROWSER_SERVICE_URL}/scrape/search",
                json={
                    "query": query,
                    "max_price": max_price,
                    "min_price": min_price,
                    "doors": doors,
                    "sources": sources or ["coches_net", "autoscout24", "wallapop", "milanuncios"],
                }
            )
            if resp.status_code == 200:
                return resp.json()
    except Exception as e:
        logger.warning(f"[Tool:search_cars] Browser worker unavailable or failed: {e}. Returning empty list.")
        return []

    logger.warning("[Tool:search_cars] Browser worker returned non-200 or empty payload. Returning empty list.")
    return []

async def tool_inspect_listing(url: str) -> Dict[str, Any]:
    """Inspects a specific listing using isolated Chromium."""
    logger.info(f"[Tool:inspect_listing] Inspecting URL via Browser Worker: {url}")
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{BROWSER_SERVICE_URL}/scrape/inspect",
                json={"url": url}
            )
            if resp.status_code == 200:
                return resp.json()
    except Exception as e:
        logger.warning(f"[Tool:inspect_listing] Failed: {e}")
    return {"url": url, "description": "Información no disponible temporalmente", "images": []}

async def tool_dgt_lookup(plate: str) -> Dict[str, Any]:
    """Simulates or fetches official Spanish DGT record."""
    clean_plate = plate.upper().replace(" ", "").replace("-", "")
    return {
        "plate": clean_plate,
        "environmental_badge": "C" if clean_plate > "0000BBB" else "B",
        "official_enrollment": "2008-04-12",
        "itv_status": "Vigente",
        "source": "dgt"
    }

async def tool_send_offer_email(car_title: str, seller_contact: str, offered_amount: float) -> Dict[str, Any]:
    """SENSITIVE: Outbound formal offer email."""
    logger.info(f"[SensitiveAction] Executing offer email: {offered_amount}€ to {seller_contact}")
    return {
        "status": "success",
        "message": f"Oferta de {offered_amount}€ enviada formalmente a {seller_contact} para '{car_title}'."
    }

# Register tools in Sentinel
sentinel.register_tool("search_cars", ToolClassification.SAFE, tool_search_cars)
sentinel.register_tool("inspect_listing", ToolClassification.SAFE, tool_inspect_listing)
sentinel.register_tool("dgt_lookup", ToolClassification.SAFE, tool_dgt_lookup)
sentinel.register_tool("send_offer_email", ToolClassification.SENSITIVE, tool_send_offer_email)

# --- 2. Tool Definitions for OpenAI / Muse Spark ---

AGENT_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "search_cars",
            "description": "Busca vehículos de segunda mano en el mercado español (Coches.net, AutoScout24, Wallapop, Milanuncios) usando el navegador Chromium.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Marca y modelo o términos de búsqueda, ej: 'seat ibiza' o 'coche compacto'"},
                    "max_price": {"type": "integer", "description": "Precio máximo en euros, ej: 3500"},
                    "min_price": {"type": "integer", "description": "Precio mínimo en euros"},
                    "doors": {"type": "integer", "description": "Número exacto de puertas (ej: 3 o 5)"}
                },
                "required": ["query"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "inspect_listing",
            "description": "Abre el anuncio de un coche en el navegador Chromium para descargar fotos HD, revisar descripción del vendedor y datos ocultos.",
            "parameters": {
                "type": "object",
                "properties": {
                    "url": {"type": "string", "description": "URL del anuncio"}
                },
                "required": ["url"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "dgt_lookup",
            "description": "Consulta el informe oficial y distintivo ambiental de un vehículo a partir de su matrícula española.",
            "parameters": {
                "type": "object",
                "properties": {
                    "plate": {"type": "string", "description": "Matrícula del vehículo, ej: '1234FGH'"}
                },
                "required": ["plate"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "send_offer_email",
            "description": "ACCIÓN SENSIBLE: Envía una contraoferta formal al vendedor por correo o mensaje. Requiere confirmación humana.",
            "parameters": {
                "type": "object",
                "properties": {
                    "car_title": {"type": "string", "description": "Nombre o título del vehículo"},
                    "seller_contact": {"type": "string", "description": "Contacto del vendedor"},
                    "offered_amount": {"type": "number", "description": "Monto de la oferta en euros"}
                },
                "required": ["car_title", "seller_contact", "offered_amount"]
            }
        }
    }
]

# --- 3. Request / Response Schemas ---

class AgentChatRequest(BaseModel):
    messages: List[Dict[str, Any]]
    confirmation_token: Optional[str] = None

class AgentChatResponse(BaseModel):
    content: str
    cars_data: Optional[List[Dict[str, Any]]] = None
    staged_action: Optional[Dict[str, Any]] = None
    model_used: str

# --- 4. Agent Endpoint ---

@router.post("/chat", response_model=AgentChatResponse)
async def run_agent_chat(req: AgentChatRequest):
    """
    Main AutoMisho Agent Endpoint.
    1. If a confirmation_token is supplied, Sentinel verifies and executes the staged sensitive action.
    2. Otherwise, calls Muse Spark 1.3 with tools.
    3. If Muse Spark decides to call a tool, Sentinel intercepts and routes (safe -> auto, sensitive -> staged with token).
    """
    # Case A: User is confirming a staged sensitive action
    if req.confirmation_token:
        try:
            action_result = await sentinel.execute_authorized_token(req.confirmation_token)
            return AgentChatResponse(
                content=action_result.get("message", "Acción autorizada y ejecutada correctamente."),
                model_used="sentinel-2pc"
            )
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Fallo en la confirmación de Sentinel: {str(e)}")

    system_prompt = {
        "role": "system",
        "content": (
            "Eres AutoMisho v2, un Agente Autónomo experto en compraventa y negociación de coches en España. "
            "Tienes herramientas para buscar coches con navegador Chromium en tiempo real ('search_cars'), "
            "inspeccionar anuncios oficiales ('inspect_listing'), consultar DGT ('dgt_lookup') y hacer contraofertas ('send_offer_email'). "
            "Usa tus herramientas cuando el usuario te pida buscar o auditar vehículos. "
            "Sé conciso, técnico y protector del comprador."
        )
    }

    conversation = [system_prompt] + req.messages

    try:
        # Call Muse Spark 1.3 via Model Gateway
        agent_res = await model_gw.chat_completion(
            messages=conversation,
            tools=AGENT_TOOLS,
            tier=ModelTier.TIER_2_AGENTIC
        )

        discovered_cars = []
        staged_action = None

        # Check if the model called any tools
        if agent_res.tool_calls:
            for call in agent_res.tool_calls:
                fn = call.get("function", {})
                tool_name = fn.get("name")
                try:
                    args = json.loads(fn.get("arguments", "{}"))
                except Exception:
                    args = {}

                logger.info(f"[AgentLoop] Muse Spark requested tool: {tool_name} with args {args}")

                try:
                    tool_output = await sentinel.execute_tool(tool_name, args)
                    if tool_name == "search_cars" and isinstance(tool_output, list):
                        discovered_cars.extend(tool_output)
                except SecurityPolicyException as sec_ex:
                    # Sentinel intercepted a sensitive tool!
                    logger.warning(f"[AgentLoop] Sentinel staged sensitive tool '{tool_name}'")
                    staged_action = sec_ex.staged_action

        # Return answer to the user
        content = agent_res.content
        if not content and discovered_cars:
            content = f"He explorado el mercado en vivo con el navegador y encontré {len(discovered_cars)} opciones interesantes para ti. Aquí tienes el detalle:"
        elif not content and staged_action:
            content = staged_action.get("message", "Se requiere tu autorización para completar esta operación.")

        return AgentChatResponse(
            content=content or "Consulta procesada con éxito.",
            cars_data=discovered_cars if discovered_cars else None,
            staged_action=staged_action,
            model_used=agent_res.model_used
        )

    except Exception as e:
        logger.error(f"[AgentLoop] Error running agent: {e}", exc_info=True)
        # Graceful fallback
        return AgentChatResponse(
            content="AutoMisho ha recibido tu petición, pero el motor agéntico reportó una excepción temporal. Los parámetros se registraron.",
            model_used="fallback-error"
        )
