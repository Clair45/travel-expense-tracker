FROM node:18-alpine

# 安装nginx
RUN apk add --no-cache nginx

# 复制前端文件
COPY *.html *.js *.css *.json /usr/share/nginx/html/

# 复制后端代码
COPY backend /app/backend

# 安装后端依赖
WORKDIR /app/backend
RUN npm install --production

# 复制nginx配置
COPY nginx.conf /etc/nginx/nginx.conf

# 暴露端口
EXPOSE 80

# 创建启动脚本
RUN echo '#!/bin/sh' > /app/start.sh && \
    echo 'cd /app/backend && node server.js &' >> /app/start.sh && \
    echo 'nginx -g "daemon off;"' >> /app/start.sh && \
    chmod +x /app/start.sh

CMD ["/app/start.sh"]
