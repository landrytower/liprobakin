# Docker Setup for Liprobakin

## 🐳 Using Docker with Rancher Desktop

### Quick Start

**1. Build the Docker image:**
```powershell
docker build -t liprobakin:latest .
```

**2. Run the container:**
```powershell
docker run -p 3000:3000 liprobakin:latest
```

**3. Or use Docker Compose:**
```powershell
docker-compose up -d
```

### Access the App
- **Local:** http://localhost:3000

### Docker Commands

**Build:**
```powershell
# Build the image
docker build -t liprobakin:latest .

# Build with no cache
docker build --no-cache -t liprobakin:latest .
```

**Run:**
```powershell
# Run in foreground
docker run -p 3000:3000 liprobakin:latest

# Run in background
docker run -d -p 3000:3000 --name liprobakin-app liprobakin:latest

# Run with environment variables
docker run -p 3000:3000 --env-file .env.local liprobakin:latest
```

**Manage:**
```powershell
# List running containers
docker ps

# Stop container
docker stop liprobakin-app

# Remove container
docker rm liprobakin-app

# View logs
docker logs liprobakin-app

# Follow logs
docker logs -f liprobakin-app
```

**Using Docker Compose:**
```powershell
# Start services
docker-compose up

# Start in background
docker-compose up -d

# Stop services
docker-compose down

# Rebuild and start
docker-compose up --build

# View logs
docker-compose logs -f
```

### Rancher Desktop Tips

**1. Access Rancher UI:**
- Open Rancher Desktop app
- Click "Containers" to see running containers
- Click "Images" to manage images

**2. Kubernetes (Optional):**
```powershell
# Enable Kubernetes in Rancher settings
# Deploy to local Kubernetes
kubectl create deployment liprobakin --image=liprobakin:latest
kubectl expose deployment liprobakin --type=LoadBalancer --port=3000
```

**3. Registry:**
```powershell
# Tag for Docker Hub
docker tag liprobakin:latest yourusername/liprobakin:latest

# Push to Docker Hub
docker push yourusername/liprobakin:latest
```

### Environment Variables

Create `.env.local` with your Firebase config:
```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=ppop-35930
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

### Troubleshooting

**Port already in use:**
```powershell
# Use different port
docker run -p 3001:3000 liprobakin:latest
```

**Container won't start:**
```powershell
# Check logs
docker logs liprobakin-app

# Run interactively
docker run -it liprobakin:latest sh
```

**Rebuild after changes:**
```powershell
# Stop and remove old container
docker stop liprobakin-app
docker rm liprobakin-app

# Rebuild image
docker build -t liprobakin:latest .

# Run new container
docker run -d -p 3000:3000 --name liprobakin-app liprobakin:latest
```

### Production Deployment

**Deploy to Cloud:**
1. **Google Cloud Run:**
```powershell
gcloud run deploy liprobakin --source .
```

2. **Azure Container Instances:**
```powershell
az container create --resource-group myResourceGroup --name liprobakin --image liprobakin:latest --ports 3000
```

3. **AWS ECS:**
   - Push image to ECR
   - Create ECS task definition
   - Deploy to ECS cluster

### Performance

**Optimize build:**
- Multi-stage build (already configured)
- Alpine Linux base image (smaller size)
- Production dependencies only
- Layer caching

**Image size:**
- Current: ~250MB
- Production-optimized with standalone output

### Next Steps

1. Test locally: `docker-compose up`
2. Verify at http://localhost:3000
3. Push to registry (Docker Hub, GitHub Container Registry)
4. Deploy to cloud platform
