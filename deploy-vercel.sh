#!/bin/bash
# PokeRogue Vercel Auto Deploy Script

cd ~/Documents/pokerogue/pokerogue

# Upstream에서 최신 변경사항 가져오기
git fetch upstream
git checkout beta
git pull upstream beta

# Vercel에 배포
vercel --prod --yes --archive=tgz

echo "Deployment completed at $(date)"
