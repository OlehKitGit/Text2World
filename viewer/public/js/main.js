const app = {
    currentImage: null,
    regions: [],
    links: [],
    isDrawing: false,
    currentRegion: null,
    mode: 'view',
    selectedROI: null,
    startX: 0,
    startY: 0,
    allImages: {},
    currentAudio: null,
    userHasInteracted: false,
    editingLocked: true,

    init() {
        console.log('App initialized');
        this.loadGallery();
        this.setupEventListeners();

        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                if (this.currentImage) {
                    this.repositionAllROIs();
                }
            }, 100);
        });
        document.getElementById('lock-editing-btn')?.addEventListener('click', () => {this.toggleEditingLock();
        this.editingLocked = true;
        document.getElementById('lock-editing-btn').textContent = 'Editing Locked';
        document.getElementById('lock-editing-btn').style.background = '#d32f2f';
});
    },

    // === АУДИО ===
    playBackgroundMusic(audioUrl, title = 'Ambient') {
        const audio = document.getElementById('bg-music');
        const player = document.getElementById('audio-player');
        const titleEl = document.getElementById('audio-title');

        if (!audioUrl) {
            audio.pause();
            audio.src = '';
            player.style.display = 'none';
            this.currentAudio = null;
            return;
        }

        if (this.currentAudio === audioUrl) return;

        audio.src = audioUrl;
        audio.loop = true;
        audio.volume = 0.4;
        titleEl.textContent = (title || 'Soundtrack').replace('.mp3', '').replace(/_/g, ' ');
        player.style.display = 'block';
        audio.play().catch(e => console.log('Автовоспроизведение заблокировано:', e));

        this.currentAudio = audioUrl;
    },

    async uploadAudio(imageId, input) {
        if (!input.files[0]) return;
        const formData = new FormData();
        formData.append('audio', input.files[0]);

        try {
            const response = await fetch(`/api/images/${imageId}/audio`, {
                method: 'POST',
                body: formData
            });
            if (!response.ok) throw new Error('Upload failed');

            this.loadGallery();
            if (this.currentImage?.id === imageId) {
                const updated = await (await fetch(`/api/images/${imageId}`)).json();
                this.playBackgroundMusic(updated.audio, updated.audioName);
            }
        } catch (e) {
            alert('Failed to upload audio: ' + e.message);
        }
    },

    async removeAudio(imageId) {
        if (!confirm('Remove music from this image?')) return;
        try {
            await fetch(`/api/images/${imageId}/audio`, { method: 'POST' });
            this.loadGallery();
            if (this.currentImage?.id === imageId) {
                this.playBackgroundMusic(null);
            }
        } catch (e) {
            alert('Failed to remove audio');
        }
    },

    setupEventListeners() {
        const imageContainer = document.getElementById('image-container');
        if (imageContainer) {
            imageContainer.addEventListener('mousedown', (e) => this.handleMouseDown(e));
            imageContainer.addEventListener('mousemove', (e) => this.handleMouseMove(e));
            imageContainer.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        }

        const targetImage = document.getElementById('target-image');
        if (targetImage) {
            targetImage.addEventListener('change', () => this.loadTargetImageRegions());
        }

        // Close modals when clicking outside
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                e.target.style.display = 'none';
            }
            if (!e.target.closest('.ROI') && !e.target.closest('#roi-menu')) {
                this.deselectROI();
            }
        });
    },

    // ========== IMAGE COORDINATE SYSTEM ==========

    // Convert screen coordinates to image-relative coordinates (0-1)
// === УДАЛИ СТАРЫЕ screenToImageCoordinates и imageToScreenCoordinates ===
// === ВСТАВЬ ЭТОТ КОД ВМЕСТО НИХ ===

    screenToImageCoordinates(clientX, clientY) {
        const img = document.getElementById('main-image');
        if (!img || !img.offsetParent) return { x: 0, y: 0 };

        const containerRect = document.getElementById('image-container').getBoundingClientRect();
        const imgRect = img.getBoundingClientRect();

        // Реальные отображаемые размеры изображения (уже с учётом object-fit: contain)
        const imgWidth = imgRect.width;
        const imgHeight = imgRect.height;
        const imgLeft = imgRect.left;
        const imgTop = imgRect.top;

        // Смещение изображения внутри контейнера
        const offsetX = imgLeft - containerRect.left;
        const offsetY = imgTop - containerRect.top;

        // Координаты клика относительно изображения
        const x = clientX - containerRect.left - offsetX;
        const y = clientY - containerRect.top - offsetY;

        return {
            x: x / imgWidth,
            y: y / imgHeight
        };
    },

    imageToScreenCoordinates(relativeX, relativeY, relativeWidth = 0, relativeHeight = 0) {
        const img = document.getElementById('main-image');
        const container = document.getElementById('image-container');
        const cRect = container.getBoundingClientRect();
        const iRect = img.getBoundingClientRect();

        const offsetX = iRect.left - cRect.left;
        const offsetY = iRect.top - cRect.top;
        const scaleX = iRect.width;
        const scaleY = iRect.height;

        return {
            x: offsetX + relativeX * scaleX,
            y: offsetY + relativeY * scaleY,
            width: relativeWidth * scaleX,
            height: relativeHeight * scaleY
        };
    },

    // Reposition all ROIs when image loads or resizes
    repositionAllROIs() {
        this.regions.forEach(region => {
            const roiElement = document.getElementById(region.id);
            if (roiElement) {
                this.positionROI(roiElement, region);
            }
        });
    },

    // Position a single ROI based on its stored relative coordinates
    positionROI(roiElement, region) {
        const screenCoords = this.imageToScreenCoordinates(
            region.relativeX, 
            region.relativeY, 
            region.relativeWidth, 
            region.relativeHeight
        );
        
        roiElement.style.left = screenCoords.x + 'px';
        roiElement.style.top = screenCoords.y + 'px';
        roiElement.style.width = screenCoords.width + 'px';
        roiElement.style.height = screenCoords.height + 'px';
    },

    toggleEditingLock() {
        this.editingLocked = !this.editingLocked;

        const btn = document.getElementById('lock-editing-btn');
        
        if (this.editingLocked) {
            btn.textContent = 'Editing Locked';
            btn.style.background = '#d32f2f';
            
            // УДАЛЯЕМ draggable и resizable со всех ROI навсегда
            document.querySelectorAll('.ROI').forEach(roi => {
                $(roi).draggable('destroy').resizable('destroy');
                roi.style.cursor = 'pointer';
            });
        } else {
            btn.textContent = 'Lock Editing';
            btn.style.background = '#007acc';
            
            // Восстанавливаем только если нужно (редко)
            document.querySelectorAll('.ROI').forEach(roi => {
                $(roi).draggable({
                    containment: '#image-container',
                    stop: () => this.updateROIPosition(roi)
                }).resizable({
                    containment: '#image-container',
                    handles: 'all',
                    stop: () => this.updateROIPosition(roi)
                });
                roi.style.cursor = 'move';
            });
        }
    },

    // ========== MODAL METHODS ==========
    showUploadModal() {
        console.log('Show upload modal');
        document.getElementById('upload-modal').style.display = 'block';
        document.getElementById('upload-status').style.display = 'none';
    },

    showGalleryModal() {
        console.log('Show gallery modal');
        document.getElementById('gallery-modal').style.display = 'block';
        this.loadGallery();
    },

    hideModal(modalType) {
        document.getElementById(modalType + '-modal').style.display = 'none';
    },

    // ========== UPLOAD METHODS ==========
    async handleUpload(e) {
        e.preventDefault();
        console.log('Handle upload');

        const fileInput = document.getElementById('image-file');
        const description = document.getElementById('image-description').value;
        const file = fileInput.files[0];

        if (!file) {
            this.showStatus('Please select a file', 'error');
            return;
        }

        const formData = new FormData();
        formData.append('image', file);
        formData.append('description', description);

        try {
            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            
            if (result.success) {
                this.showStatus('Upload successful!', 'success');
                this.hideModal('upload');
                this.loadImage(result.image.id);
                this.loadGallery();
            } else {
                this.showStatus(result.error, 'error');
            }
        } catch (error) {
            console.error('Upload error:', error);
            this.showStatus('Upload failed', 'error');
        }
    },

    showStatus(message, type) {
        const status = document.getElementById('upload-status');
        status.textContent = message;
        status.className = type;
        status.style.display = 'block';
    },

    // ========== GALLERY METHODS ==========
// ========== GALLERY METHODS ==========
    async loadGallery() {
        try {
            const response = await fetch('/api/images');
            const images = await response.json();
            this.allImages = images;
            this.displayGallery(images);
        } catch (error) {
            console.error('Gallery load error:', error);
            document.getElementById('gallery-grid').innerHTML = 'Failed to load gallery';
        }
    },

    displayGallery(images) {
        const galleryGrid = document.getElementById('gallery-grid');
        galleryGrid.innerHTML = ''; // очищаем

        // Если нет изображений
        if (Object.keys(images).length === 0) {
            galleryGrid.innerHTML = '<p style="color:#888; text-align:center; padding:20px;">No images yet. Upload the first one!</p>';
            return;
        }

        Object.values(images).forEach(image => {
            const item = document.createElement('div');
            item.className = 'gallery-item';

            item.innerHTML = `
                <img src="${image.path}" 
                     alt="${image.originalName}" 
                     style="width:100%; height:120px; object-fit:cover; background:#000;">
                <div class="gallery-item-info">
                    <div class="gallery-item-name">${image.originalName}</div>
                    <div class="gallery-item-stats">
                        ${image.audio ? 'Music' : 'No music'} • 
                        ${image.regions?.length || 0} region${(image.regions?.length || 0) === 1 ? '' : 's'}
                    </div>
                    <div class="gallery-item-actions">
                        <button class="btn-load" onclick="app.loadImage('${image.id}'); document.getElementById('gallery-modal').style.display='none';">Load</button>

                        <label class="btn-small" style="background:${image.audio ? '#8a4caf' : '#666'}; cursor:pointer;">
                            ${image.audio ? 'Music' : 'Add Music'}
                            <input type="file" accept="audio/mp3,audio/mpeg" style="display:none;" 
                                   onchange="app.uploadAudio('${image.id}', this)">
                        </label>

                        ${image.audio ? `
                            <button class="btn-small" style="background:#c42c2c;" 
                                    onclick="app.removeAudio('${image.id}')">Remove</button>
                        ` : ''}

                        <button class="btn-delete" onclick="app.deleteImage('${image.id}')">Delete</button>
                    </div>
                </div>
            `;

            galleryGrid.appendChild(item);
        });
    },

    updateGalleryScrollContainer() {
        const modal = document.getElementById('gallery-modal');
        const scrollContainer = modal.querySelector('.gallery-scroll-container');
        
        if (scrollContainer) {
            // Автоматическая настройка максимальной высоты в зависимости от размера окна
            const viewportHeight = window.innerHeight;
            const maxHeight = Math.min(viewportHeight * 0.7, 600); // Максимум 70% высоты окна или 600px
            scrollContainer.style.maxHeight = maxHeight + 'px';
        }
    },

    // Обновляем метод showGalleryModal

    async deleteImage(imageId) {
        if (!confirm('Are you sure you want to delete this image? This will also delete all regions and links associated with it.')) {
            return;
        }

        try {
            const response = await fetch(`/api/images/${imageId}`, {
                method: 'DELETE'
            });

            const result = await response.json();
            
            if (result.success) {
                if (this.currentImage && this.currentImage.id === imageId) {
                    this.currentImage = null;
                    document.getElementById('main-image').style.display = 'none';
                    document.getElementById('no-image').style.display = 'block';
                    document.getElementById('roi-container').innerHTML = '';
                    this.regions = [];
                    this.links = [];
                    this.updateInfoPanel();
                }

                delete this.allImages[imageId];
                this.loadGallery();
                alert('Image deleted successfully');
            } else {
                alert('Failed to delete image');
            }
        } catch (error) {
            console.error('Delete image error:', error);
            alert('Error deleting image');
        }
    },

    // ========== IMAGE METHODS ==========
// 1. Новый метод — гарантирует, что мы работаем с актуальными размерами
forceReflowAndReposition() {
    // Принудительно заставляем браузер пересчитать layout
    void document.getElementById('main-image').offsetHeight;
    void document.getElementById('image-container').getBoundingClientRect();

    // Два кадра — чтобы точно всё пересчиталось
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            this.repositionAllROIs();
        });
    });
},

// 2. Полностью переписанный loadImage()
    async loadImage(imageId) {
        try {
            const response = await fetch(`/api/images/${imageId}`);
            const image = await response.json();
            
            this.currentImage = image;
            const mainImage = document.getElementById('main-image');
            
            // Полный сброс
            mainImage.src = '';
            document.getElementById('roi-container').innerHTML = '';
            this.regions = [];
            this.links = [];

            // Ждём тик
            await new Promise(r => setTimeout(r, 0));
            
            mainImage.src = image.path;
            mainImage.style.display = 'block';
            document.getElementById('no-image').style.display = 'none';

            // Ждём полной загрузки
            await new Promise(resolve => {
                if (mainImage.complete && mainImage.naturalWidth) {
                    resolve();
                } else {
                    mainImage.onload = resolve;
                    mainImage.onerror = () => resolve(); // на случай кэша
                }
            });

            // САМОЕ ВАЖНОЕ: ждём, пока браузер реально отрисует изображение
            await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

            // ТОЛЬКО ТЕПЕРЬ загружаем регионы
            this.regions = image.regions || [];
            this.regions.forEach(region => this.createROI(region));

            await this.loadLinks();
            this.updateInfoPanel();
            
            if (image.audio) {
                this.playBackgroundMusic(image.audio, image.audioName || 'Soundtrack');
            } else {
                this.playBackgroundMusic(null);
            }

            // Финальная подстраховка — если где-то что-то не успело
            setTimeout(() => this.repositionAllROIs(), 50);

        } catch (error) {
            console.error('Load error:', error);
        }
        if (this.editingLocked) {
        document.querySelectorAll('.ROI').forEach(roi => {
            $(roi).draggable('destroy').resizable('destroy');
            roi.style.cursor = 'pointer';
        });
    }
    },

    async loadRegions() {
        if (!this.currentImage) return;

        this.regions = this.currentImage.regions || [];

        this.regions.forEach(region => {
            this.createROI(region);
        });

        this.updateRegionsList();
    },

    async loadLinks() {
        if (!this.currentImage) return;
        
        try {
            const response = await fetch(`/api/images/${this.currentImage.id}/links`);
            this.links = await response.json();
            console.log('Loaded links:', this.links.length);
            this.updateROILinkIndicators();
        } catch (error) {
            console.error('Load links error:', error);
        }
    },

    updateROILinkIndicators() {
        this.regions.forEach(region => {
            const roiElement = document.getElementById(region.id);
            if (roiElement) {
                const hasLinks = this.links.some(link => 
                    link.sourceImageId === this.currentImage.id && link.sourceRegionId === region.id
                );
                
                if (hasLinks) {
                    this.markROIAsLinked(roiElement);
                }
            }
        });
    },

    markROIAsLinked(roiElement) {
        roiElement.style.borderColor = '#ff9900';
        roiElement.style.backgroundColor = 'rgba(255, 153, 0, 0.2)';
        
        if (!roiElement.querySelector('.link-indicator')) {
            const indicator = document.createElement('div');
            indicator.className = 'link-indicator';
            indicator.innerHTML = '🔗';
            indicator.style.cssText = `
                position: absolute;
                top: -8px;
                right: -8px;
                background: #ff9900;
                border-radius: 50%;
                width: 20px;
                height: 20px;
                font-size: 12px;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                z-index: 15;
            `;
            roiElement.appendChild(indicator);
        }
    },

    updateInfoPanel() {
        if (!this.currentImage) return;
        
        const info = document.getElementById('image-info');
        const regionCount = this.regions.length;
        const linkCount = this.links.length;
        
        info.innerHTML = `
            <p><strong>${this.currentImage.originalName}</strong></p>
            <p>${this.currentImage.description || 'No description'}</p>
            <p>Uploaded: ${new Date(this.currentImage.uploadDate).toLocaleDateString()}</p>
            <p>Size: ${Math.round(this.currentImage.size / 1024)} KB</p>
            <p>Regions: ${regionCount}</p>
            <p>Links: ${linkCount}</p>
            <button class="btn-delete" onclick="app.deleteImage('${this.currentImage.id}')" style="margin-top: 10px; width: 100%;">Delete This Image</button>
        `;
    },

    updateRegionsList() {
        const list = document.getElementById('regions-list');
        if (!list) return;

        list.innerHTML = '<h4>Regions:</h4>';
        this.regions.forEach(region => {
            const div = document.createElement('div');
            div.className = 'region-item';
            
            const linkCount = this.links.filter(link => 
                link.sourceImageId === this.currentImage.id && link.sourceRegionId === region.id
            ).length;
            
            div.innerHTML = `
                <strong>${region.name}</strong>
                <br><small>Links: ${linkCount}</small>
                <button class="btn-small" onclick="app.deleteROI('${region.id}')">Delete</button>
            `;
            list.appendChild(div);
        });
    },

    // ========== ROI METHODS ==========
    startRegionMode() {
        if (!this.currentImage) {
            alert('Please load an image first');
            return;
        }
        this.mode = 'region';
        //alert('Click and drag to create a region. Release to name it.');
    },

    handleMouseDown(e) {
        if (this.mode !== 'region' || !this.currentImage) return;
        if (e.target.closest('.ROI')) return;

        const container = document.getElementById('image-container');
        const rect = container.getBoundingClientRect();
        
        this.startX = e.clientX - rect.left;
        this.startY = e.clientY - rect.top;
        this.isDrawing = true;
        
        this.currentRegion = document.createElement('div');
        this.currentRegion.className = 'ROI drawing';
        this.currentRegion.style.left = this.startX + 'px';
        this.currentRegion.style.top = this.startY + 'px';
        this.currentRegion.style.width = '0px';
        this.currentRegion.style.height = '0px';
        
        document.getElementById('roi-container').appendChild(this.currentRegion);
    },

    handleMouseMove(e) {
        if (!this.isDrawing || !this.currentRegion) return;

        const container = document.getElementById('image-container');
        const rect = container.getBoundingClientRect();
        const currentX = e.clientX - rect.left;
        const currentY = e.clientY - rect.top;

        const width = currentX - this.startX;
        const height = currentY - this.startY;

        this.currentRegion.style.width = Math.abs(width) + 'px';
        this.currentRegion.style.height = Math.abs(height) + 'px';
        
        if (width < 0) this.currentRegion.style.left = currentX + 'px';
        if (height < 0) this.currentRegion.style.top = currentY + 'px';
    },

    handleMouseUp(e) {
        if (!this.isDrawing || !this.currentRegion) return;

        this.isDrawing = false;
        
        const container = document.getElementById('image-container');
        const rect = container.getBoundingClientRect();
        const endX = e.clientX - rect.left;
        const endY = e.clientY - rect.top;

        const width = Math.abs(endX - this.startX);
        const height = Math.abs(endY - this.startY);

        if (width > 20 && height > 20) {
            this.finalizeROI(this.currentRegion, this.startX, this.startY, width, height);
        } else {
            this.currentRegion.remove();
        }
        
        this.currentRegion = null;
        this.mode = 'view';
    },

    finalizeROI(roiElement, startX, startY, width, height) {
        roiElement.classList.remove('drawing');
        
        const name = prompt('Enter region name:', 'New Region');
        if (!name) {
            roiElement.remove();
            return;
        }

        const roiId = 'roi_' + Date.now();
        roiElement.id = roiId;
        roiElement.innerHTML = `<div class="ROI_hint">${name}</div>`;

        // Convert screen coordinates to image-relative coordinates
        const startCoords = this.screenToImageCoordinates(startX, startY);
        const endCoords = this.screenToImageCoordinates(startX + width, startY + height);
        
        const relativeX = Math.min(startCoords.x, endCoords.x);
        const relativeY = Math.min(startCoords.y, endCoords.y);
        const relativeWidth = Math.abs(endCoords.x - startCoords.x);
        const relativeHeight = Math.abs(endCoords.y - startCoords.y);

        // Position ROI using relative coordinates
        this.positionROI(roiElement, {
            relativeX, relativeY, relativeWidth, relativeHeight
        });

        // Make draggable and resizable
        $(roiElement).draggable({ 
            containment: '#image-container',
            stop: () => this.updateROIPosition(roiElement)
        }).resizable({ 
            containment: '#image-container', 
            handles: 'all',
            stop: () => this.updateROIPosition(roiElement)
        });

        // Event handlers
        roiElement.onclick = (e) => {
            e.stopPropagation();
            this.selectROI(roiElement);
        };

        roiElement.ondblclick = (e) => {
            e.stopPropagation();
            this.navigateFromROI(roiId);
        };

        roiElement.onmouseenter = () => {
            const hasLinks = this.links.some(link => 
                link.sourceImageId === this.currentImage.id && link.sourceRegionId === roiId
            );
            if (hasLinks) {
                roiElement.style.cursor = 'pointer';
                roiElement.title = 'Double-click to follow link';
            }
        };

        // Save with relative coordinates
        this.saveROI(roiId, relativeX, relativeY, relativeWidth, relativeHeight, name);
    },

   createROI(region) {
        const roiElement = document.createElement('div');
        roiElement.className = 'ROI';
        roiElement.id = region.id;
        roiElement.innerHTML = `<div class="ROI_hint">${region.name}</div>`;

        // Сразу позиционируем правильно
        this.positionROI(roiElement, region);

        // Добавляем в DOM
        document.getElementById('roi-container').appendChild(roiElement);

        // Делаем draggable/resizable ТОЛЬКО ПОСЛЕ добавления в DOM
        $(roiElement).draggable({
            containment: '#image-container',
            stop: () => this.updateROIPosition(roiElement)
        }).resizable({
            containment: '#image-container',
            handles: 'all',
            stop: () => this.updateROIPosition(roiElement)
        });

        roiElement.onclick = e => { e.stopPropagation(); this.selectROI(roiElement); };
        roiElement.ondblclick = e => { e.stopPropagation(); this.navigateFromROI(region.id); };
    },

    async updateROIPosition(roiElement) {
        const style = roiElement.getBoundingClientRect();
        const screenX = parseFloat(style.left);
        const screenY = parseFloat(style.top);
        const screenWidth = parseFloat(style.width);
        const screenHeight = parseFloat(style.height);
        
        // Convert current screen position back to relative coordinates
        const startCoords = this.screenToImageCoordinates(screenX, screenY);
        const endCoords = this.screenToImageCoordinates(screenX + screenWidth, screenY + screenHeight);
        
        const relativeX = Math.min(startCoords.x, endCoords.x);
        const relativeY = Math.min(startCoords.y, endCoords.y);
        const relativeWidth = Math.abs(endCoords.x - startCoords.x);
        const relativeHeight = Math.abs(endCoords.y - startCoords.y);

        const regionData = {
            id: roiElement.id,
            relativeX, relativeY, relativeWidth, relativeHeight,
            name: roiElement.querySelector('.ROI_hint').textContent
        };
        
        await this.saveROI(regionData.id, relativeX, relativeY, relativeWidth, relativeHeight, regionData.name);
    },

    selectROI(roiElement) {
        this.deselectROI();
        this.selectedROI = roiElement;
        roiElement.classList.add('selected');
        
        const rect = roiElement.getBoundingClientRect();
        const menu = document.getElementById('roi-menu');
        menu.style.display = 'block';
        menu.style.left = rect.right + 'px';
        menu.style.top = rect.top + 'px';
    },

    deselectROI() {
        if (this.selectedROI) {
            this.selectedROI.classList.remove('selected');
        }
        document.getElementById('roi-menu').style.display = 'none';
    },

    renameSelectedROI() {
        if (!this.selectedROI) return;
        const hint = this.selectedROI.querySelector('.ROI_hint');
        const newName = prompt('New name:', hint.textContent);
        if (newName) {
            hint.textContent = newName;
            this.updateROIPosition(this.selectedROI);
        }
        this.deselectROI();
    },

    deleteSelectedROI() {
        if (!this.selectedROI) return;
        if (confirm('Delete this region?')) {
            this.deleteROI(this.selectedROI.id);
            this.selectedROI.remove();
            this.deselectROI();
        }
    },

    async deleteROI(roiId) {
        if (!this.currentImage) return;
        
        try {
            const response = await fetch(`/api/images/${this.currentImage.id}/regions/${roiId}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                this.regions = this.regions.filter(r => r.id !== roiId);
                this.updateRegionsList();
            }
        } catch (error) {
            console.error('Delete ROI error:', error);
        }
    },

    async saveROI(roiId, relativeX, relativeY, relativeWidth, relativeHeight, name) {
        if (!this.currentImage) return;

        const regionData = { 
            id: roiId, 
            relativeX, relativeY, relativeWidth, relativeHeight,
            name 
        };
        
        try {
            const response = await fetch(`/api/images/${this.currentImage.id}/regions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(regionData)
            });
            
            const result = await response.json();
            if (result.success) {
                const existingIndex = this.regions.findIndex(r => r.id === roiId);
                if (existingIndex >= 0) {
                    this.regions[existingIndex] = result.region;
                } else {
                    this.regions.push(result.region);
                }
                this.updateRegionsList();
            }
        } catch (error) {
            console.error('Save ROI error:', error);
        }
    },

    // ========== LINK METHODS ==========
    showLinkPanel() {
        if (!this.currentImage) {
            alert('Please load an image first');
            return;
        }
        if (!this.selectedROI) {
            alert('Please select a region first');
            return;
        }

        this.populateLinkForm();
        document.getElementById('link-panel').style.display = 'block';
    },

    populateLinkForm() {
        const source = document.getElementById('source-region');
        const targetImage = document.getElementById('target-image');
        const targetRegion = document.getElementById('target-region');

        source.innerHTML = '';
        this.regions.forEach(region => {
            const option = document.createElement('option');
            option.value = region.id;
            option.textContent = region.name;
            if (region.id === this.selectedROI.id) option.selected = true;
            source.appendChild(option);
        });

        targetImage.innerHTML = '<option value="">Select Target Image</option>';
        Object.values(this.allImages).forEach(image => {
            if (image.id !== this.currentImage.id) {
                const option = document.createElement('option');
                option.value = image.id;
                option.textContent = image.originalName;
                targetImage.appendChild(option);
            }
        });

        targetRegion.innerHTML = '<option value="">Select image first</option>';
        targetRegion.disabled = true;
    },

    addLinkToROI() {
        this.showLinkPanel();
        this.deselectROI();
    },

    async loadTargetImageRegions() {
        const targetImageId = document.getElementById('target-image').value;
        const targetRegion = document.getElementById('target-region');

        if (!targetImageId) {
            targetRegion.innerHTML = '<option value="">Select image first</option>';
            targetRegion.disabled = true;
            return;
        }

        try {
            const response = await fetch(`/api/images/${targetImageId}`);
            const image = await response.json();
            
            targetRegion.innerHTML = '<option value="">Select Region (optional)</option>';
            (image.regions || []).forEach(region => {
                const option = document.createElement('option');
                option.value = region.id;
                option.textContent = region.name;
                targetRegion.appendChild(option);
            });
            targetRegion.disabled = false;
        } catch (error) {
            console.error('Load target regions error:', error);
        }
    },

    async createLink() {
        const sourceId = document.getElementById('source-region').value;
        const targetImageId = document.getElementById('target-image').value;
        const targetRegionId = document.getElementById('target-region').value;

        if (!sourceId || !targetImageId) {
            alert('Please select source region and target image');
            return;
        }

        const linkData = {
            sourceImageId: this.currentImage.id,
            sourceRegionId: sourceId,
            targetImageId: targetImageId,
            targetRegionId: targetRegionId || null
        };

        try {
            const response = await fetch('/api/links', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(linkData)
            });

            const result = await response.json();
            if (result.success) {
                this.links.push(result.link);
                this.hideLinkPanel();
                
                const sourceROI = document.getElementById(sourceId);
                if (sourceROI) {
                    this.markROIAsLinked(sourceROI);
                }
                
                this.updateRegionsList();
                alert('Link created successfully! Double-click the region to navigate.');
            } else {
                alert('Failed to create link: ' + result.error);
            }
        } catch (error) {
            console.error('Create link error:', error);
            alert('Failed to create link');
        }
    },

    hideLinkPanel() {
        document.getElementById('link-panel').style.display = 'none';
    },

    // ========== NAVIGATION METHODS ==========
    async navigateFromROI(roiId) {
        console.log('Navigating from ROI:', roiId);
        
        try {
            const response = await fetch(`/api/images/${this.currentImage.id}/regions/${roiId}/links`);
            const outgoingLinks = await response.json();
            
            console.log('Found outgoing links:', outgoingLinks);

            if (outgoingLinks.length === 0) {
                alert('This region has no links. Use "Add Link" to create one.');
                return;
            }

            if (outgoingLinks.length === 1) {
                await this.navigateToLink(outgoingLinks[0]);
            } else {
                this.showLinkSelection(outgoingLinks);
            }
        } catch (error) {
            console.error('Navigation error:', error);
            alert('Error navigating from region');
        }
    },

    async navigateToLink(link) {
        console.log('Navigating to link:', link);

        await this.loadImage(link.targetImageId);

        // ← ВОТ ЭТО ГЛАВНОЕ — МУЗЫКА ВКЛЮЧАЕТСЯ ПРИ ЛЮБОМ ПЕРЕХОДЕ!
        if (this.currentImage?.audio) {
            // Если пользователь уже взаимодействовал (кликал) — можно играть сразу
            if (window.userHasInteracted) {
                this.playBackgroundMusic(this.currentImage.audio, this.currentImage.audioName);
            } else {
                // Если ещё не было клика — включаем при первом же взаимодействии
                const unlockAudio = () => {
                    window.userHasInteracted = true;
                    this.playBackgroundMusic(this.currentImage.audio, this.currentImage.audioName);
                    document.getElementById('image-container').removeEventListener('click', unlockAudio);
                };
                document.getElementById('image-container').addEventListener('click', unlockAudio, { once: true });
            }
        } else {
            this.playBackgroundMusic(null);
        }

        // Подсветка целевого региона (если есть)
        if (link.targetRegionId) {
            setTimeout(() => {
                const targetROI = document.getElementById(link.targetRegionId);
                if (targetROI) {
                    targetROI.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    targetROI.style.boxShadow = '0 0 0 4px #ff9900';
                    setTimeout(() => targetROI.style.boxShadow = '', 3000);
                }
            }, 500);
        }
    },

        showLinkSelection(links) {
            let message = 'Select destination:\n\n';
            links.forEach((link, index) => {
                const image = this.allImages[link.targetImageId];
                const regionInfo = link.targetRegionId ? ' (specific region)' : ' (whole image)';
                message += `${index + 1}. ${image.originalName}${regionInfo}\n`;
            });

            const choice = prompt(message + '\nEnter number:');
            const index = parseInt(choice) - 1;

            if (index >= 0 && index < links.length) {
                this.navigateToLink(links[index]);
            }
        },

        // ========== UTILITY METHODS ==========
        saveData() {
            alert('All data is automatically saved to the server');
        }
    };

// Initialize app when page loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('Page loaded, initializing app...');
    app.init();
});

// === АВТОЗАПУСК ПЕРВОГО СЛАЙДА — КАК В КИНО! ===
async function autoStartFirstSlide() {
    try {
        const response = await fetch('/api/images');
        const images = await response.json();
        const allIds = Object.keys(images);

        if (allIds.length > 0) {
            // Берём самый первый загруженный слайд (по дате — самый старый)
            const firstImageId = allIds[0];
            // Или, если хочешь по алфавиту: allIds.sort()[0]

            console.log('Запускаем интерактивное кино с первого слайда:', images[firstImageId].originalName);
            await app.loadImage(firstImageId);

            // Опционально: скрываем "No Image" навсегда
            document.getElementById('no-image').style.display = 'none';
        }
    } catch (err) {
        console.log('Галерея пуста — ждём первого слайда от пользователя');
    }
}

// Запускаем автозагрузку после инициализации приложения
document.addEventListener('DOMContentLoaded', () => {
    console.log('Page loaded, initializing app...');
    app.init();
    
    // ← ВОТ ЭТО ГЛАВНОЕ!
    setTimeout(autoStartFirstSlide, 500); // небольшая задержка, чтобы всё прогрузилось
});