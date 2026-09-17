FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Install dependencies needed for sharp / native modules if any
RUN apk add --no-cache libc6-compat

COPY package.json package-lock.json* ./
COPY prisma ./prisma/

RUN npm ci --ignore-scripts
RUN npx prisma generate

COPY . .

# Build Next.js
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build -- --webpack

EXPOSE 3000

CMD ["npm", "run", "start"]
