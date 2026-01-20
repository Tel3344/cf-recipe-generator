// ============================================
// 智能菜谱推荐系统 - PDF导出模块
// ============================================

class PDFExporter {
    constructor() {
        this.config = {
            pageSize: 'a4',
            orientation: 'portrait',
            unit: 'mm',
            margin: {
                top: 20,
                right: 15,
                bottom: 20,
                left: 15
            },
            colors: {
                primary: [46, 139, 87],    // #2E8B57
                secondary: [255, 107, 53], // #FF6B35
                accent: [78, 205, 196],    // #4ECDC4
                text: [44, 62, 80],        // #2C3E50
                muted: [127, 140, 141]     // #7F8C8D
            },
            fonts: {
                normal: 'notosanssc',
                bold: 'notosanssc-bold',
                light: 'notosanssc-light'
            },
            logo: null
        };
        
        this.currentDoc = null;
        this.currentPage = 1;
        this.pageWidth = 0;
        this.pageHeight = 0;
        this.currentY = 0;
        
        this.init();
    }
    
    // 初始化
    async init() {
        // 加载中文字体（如果可用）
        await this.loadChineseFonts();
        
        // 加载logo
        await this.loadLogo();
    }
    
    // 加载中文字体
    async loadChineseFonts() {
        try {
            // 预定义字体（需要将字体文件放在项目中）
            const fontUrl = '/fonts/notosanssc-normal.ttf';
            
            // 检查字体是否可用
            const fontResponse = await fetch(fontUrl, { method: 'HEAD' });
            if (fontResponse.ok) {
                this.config.fonts.normal = 'notosanssc';
            } else {
                // 使用默认字体
                console.log('未找到中文字体，使用默认字体');
                this.config.fonts.normal = 'helvetica';
                this.config.fonts.bold = 'helvetica';
                this.config.fonts.light = 'helvetica';
            }
        } catch (error) {
            console.warn('加载字体失败:', error);
        }
    }
    
    // 加载logo
    async loadLogo() {
        try {
            // 尝试加载SVG logo
            const response = await fetch('/icons/icon.svg');
            if (response.ok) {
                this.config.logo = await response.text();
            }
        } catch (error) {
            // 忽略错误，使用默认logo
        }
    }
    
    // 导出菜单到PDF
    async exportMenu(menuData, options = {}) {
        try {
            const { jsPDF } = window.jspdf;
            
            // 创建PDF文档
            this.currentDoc = new jsPDF({
                orientation: this.config.orientation,
                unit: this.config.unit,
                format: this.config.pageSize
            });
            
            // 设置页面尺寸
            this.pageWidth = this.currentDoc.internal.pageSize.getWidth();
            this.pageHeight = this.currentDoc.internal.pageSize.getHeight();
            this.currentY = this.config.margin.top;
            
            // 添加字体（如果可用）
            await this.addFontsToDoc();
            
            // 生成PDF内容
            await this.generatePDFContent(menuData, options);
            
            // 保存PDF
            const fileName = this.getFileName(options);
            this.currentDoc.save(fileName);
            
            return {
                success: true,
                fileName: fileName,
                pageCount: this.currentPage
            };
        } catch (error) {
            console.error('导出PDF失败:', error);
            throw new Error(`导出失败: ${error.message}`);
        }
    }
    
    // 生成PDF内容
    async generatePDFContent(menuData, options) {
        // 封面页
        await this.addCoverPage(menuData, options);
        
        // 菜单详情页
        this.addNewPage();
        await this.addMenuDetails(menuData, options);
        
        // 菜谱详情页
        if (options.includeRecipes) {
            await this.addRecipePages(menuData, options);
        }
        
        // 营养信息页
        if (options.includeNutrition && menuData.营养信息) {
            this.addNewPage();
            await this.addNutritionInfo(menuData.营养信息);
        }
        
        // 购物清单页
        if (options.includeShoppingList && menuData.购物清单) {
            this.addNewPage();
            await this.addShoppingList(menuData.购物清单);
        }
        
        // 页脚
        this.addPageFooter();
    }
    
    // 添加封面页
    async addCoverPage(menuData, options) {
        const { config, currentDoc, pageWidth } = this;
        
        // 背景色
        currentDoc.setFillColor(...config.colors.primary);
        currentDoc.rect(0, 0, pageWidth, this.pageHeight, 'F');
        
        // Logo
        if (config.logo) {
            try {
                currentDoc.addImage({
                    imageData: config.logo,
                    x: pageWidth / 2 - 30,
                    y: 60,
                    width: 60,
                    height: 60,
                    format: 'SVG'
                });
            } catch (error) {
                // 如果SVG失败，使用文本logo
                currentDoc.setFontSize(48);
                currentDoc.setTextColor(255, 255, 255);
                currentDoc.text('🍳', pageWidth / 2, 90, { align: 'center' });
            }
        } else {
            currentDoc.setFontSize(48);
            currentDoc.setTextColor(255, 255, 255);
            currentDoc.text('🍳', pageWidth / 2, 90, { align: 'center' });
        }
        
        // 标题
        currentDoc.setFont(config.fonts.bold);
        currentDoc.setFontSize(32);
        currentDoc.setTextColor(255, 255, 255);
        currentDoc.text('智能推荐菜单', pageWidth / 2, 130, { align: 'center' });
        
        // 副标题
        currentDoc.setFont(config.fonts.normal);
        currentDoc.setFontSize(18);
        currentDoc.setTextColor(255, 255, 255, 0.9);
        currentDoc.text('食刻 · 时令智能菜谱系统', pageWidth / 2, 150, { align: 'center' });
        
        // 菜单信息
        const menuInfoY = 180;
        
        currentDoc.setFontSize(16);
        currentDoc.text(`用餐人数: ${menuData.参数?.用餐人数 || 6}人`, pageWidth / 2, menuInfoY, { align: 'center' });
        
        currentDoc.text(`适用季节: ${menuData.参数?.季节 || '春季'}`, pageWidth / 2, menuInfoY + 10, { align: 'center' });
        
        currentDoc.text(`生成时间: ${this.formatDate(menuData.生成时间)}`, pageWidth / 2, menuInfoY + 20, { align: 'center' });
        
        // 分隔线
        currentDoc.setDrawColor(255, 255, 255, 0.5);
        currentDoc.setLineWidth(0.5);
        currentDoc.line(40, 220, pageWidth - 40, 220);
        
        // 提示信息
        currentDoc.setFontSize(12);
        currentDoc.setTextColor(255, 255, 255, 0.7);
        currentDoc.text('营养均衡 · 时令搭配 · 智能推荐', pageWidth / 2, 240, { align: 'center' });
        
        // 版本信息
        currentDoc.setFontSize(10);
        currentDoc.text(`版本 v1.0 · ${new Date().getFullYear()} 食刻智能菜谱`, pageWidth / 2, 280, { align: 'center' });
    }
    
    // 添加菜单详情页
    async addMenuDetails(menuData, options) {
        const { config, currentDoc, pageWidth } = this;
        this.currentY = config.margin.top;
        
        // 页面标题
        currentDoc.setFont(config.fonts.bold);
        currentDoc.setFontSize(24);
        currentDoc.setTextColor(...config.colors.primary);
        currentDoc.text('推荐菜单详情', pageWidth / 2, this.currentY, { align: 'center' });
        this.currentY += 15;
        
        // 菜单统计
        currentDoc.setFont(config.fonts.normal);
        currentDoc.setFontSize(12);
        currentDoc.setTextColor(...config.colors.muted);
        
        const totalRecipes = Object.values(menuData.菜单 || {}).flat().length;
        const totalTime = this.calculateTotalTime(menuData.菜单);
        
        currentDoc.text(`菜品总数: ${totalRecipes}道`, 20, this.currentY);
        currentDoc.text(`预计总耗时: ${this.formatTime(totalTime)}`, pageWidth - 20, this.currentY, { align: 'right' });
        this.currentY += 10;
        
        // 分隔线
        this.addDivider();
        
        // 按类别显示菜谱
        const categories = ['主菜', '配菜', '汤品', '主食'];
        
        for (const category of categories) {
            const recipes = menuData.菜单?.[category] || [];
            if (recipes.length === 0) continue;
            
            // 检查是否需要换页
            if (this.currentY > this.pageHeight - 50) {
                this.addNewPage();
            }
            
            // 类别标题
            this.addCategoryTitle(category, recipes.length);
            
            // 菜谱列表
            for (const recipe of recipes) {
                if (this.currentY > this.pageHeight - 40) {
                    this.addNewPage();
                }
                
                this.addRecipeItem(recipe, category);
            }
            
            this.currentY += 5;
        }
        
        // 烹饪提示
        if (menuData.提示 && menuData.提示.length > 0) {
            this.addCookingTips(menuData.提示);
        }
    }
    
    // 添加菜谱详情页
    async addRecipePages(menuData, options) {
        const allRecipes = Object.values(menuData.菜单 || {}).flat();
        
        for (const recipe of allRecipes) {
            // 检查是否需要新页面
            if (this.currentY > this.pageHeight - 100) {
                this.addNewPage();
            } else if (this.currentY > 50) {
                // 添加分隔符
                this.addDivider();
                this.currentY += 10;
            }
            
            await this.addRecipeDetail(recipe);
        }
    }
    
    // 添加菜谱详情
    async addRecipeDetail(recipe) {
        const { config, currentDoc, pageWidth } = this;
        
        // 菜谱标题
        currentDoc.setFont(config.fonts.bold);
        currentDoc.setFontSize(18);
        currentDoc.setTextColor(...config.colors.primary);
        currentDoc.text(recipe.菜品名称, 20, this.currentY);
        this.currentY += 10;
        
        // 菜谱描述
        if (recipe.菜品描述) {
            currentDoc.setFont(config.fonts.normal);
            currentDoc.setFontSize(11);
            currentDoc.setTextColor(...config.colors.text);
            
            const descriptionLines = currentDoc.splitTextToSize(recipe.菜品描述, pageWidth - 40);
            currentDoc.text(descriptionLines, 20, this.currentY);
            this.currentY += descriptionLines.length * 5 + 5;
        }
        
        // 基本信息
        currentDoc.setFont(config.fonts.normal);
        currentDoc.setFontSize(10);
        currentDoc.setTextColor(...config.colors.muted);
        
        const infoY = this.currentY;
        currentDoc.text(`准备时间: ${recipe.准备时间 || 0}分钟`, 20, infoY);
        currentDoc.text(`烹饪时间: ${recipe.烹饪时间 || 0}分钟`, 70, infoY);
        currentDoc.text(`难度: ${recipe.难度等级 || '初级'}`, 120, infoY);
        currentDoc.text(`份量: ${recipe.标准份量?.基准人数 || 4}人`, 150, infoY);
        this.currentY += 8;
        
        // 分隔线
        this.addDivider();
        this.currentY += 5;
        
        // 食材清单
        if (recipe.标准份量?.食材列表) {
            this.addIngredientsList(recipe.标准份量.食材列表, recipe.标准份量?.调味料);
        }
        
        // 烹饪步骤
        if (recipe.烹饪步骤 && Array.isArray(recipe.烹饪步骤)) {
            this.addCookingSteps(recipe.烹饪步骤);
        }
        
        // 烹饪技巧
        if (recipe.烹饪技巧 && Array.isArray(recipe.烹饪技巧)) {
            this.addCookingTips(recipe.烹饪技巧, '技巧提示');
        }
        
        this.currentY += 10;
    }
    
    // 添加营养信息
    async addNutritionInfo(nutritionData) {
        const { config, currentDoc, pageWidth } = this;
        this.currentY = config.margin.top;
        
        // 标题
        currentDoc.setFont(config.fonts.bold);
        currentDoc.setFontSize(24);
        currentDoc.setTextColor(...config.colors.primary);
        currentDoc.text('营养分析报告', pageWidth / 2, this.currentY, { align: 'center' });
        this.currentY += 15;
        
        // 总体评价
        if (nutritionData.评价?.总体) {
            currentDoc.setFont(config.fonts.normal);
            currentDoc.setFontSize(14);
            currentDoc.setTextColor(...this.getNutritionColor(nutritionData.评价.总体));
            currentDoc.text(`总体评价: ${nutritionData.评价.总体}`, pageWidth / 2, this.currentY, { align: 'center' });
            this.currentY += 10;
        }
        
        this.addDivider();
        this.currentY += 5;
        
        // 营养数据表格
        this.addNutritionTable(nutritionData);
        
        // 营养建议
        if (nutritionData.建议 && nutritionData.建议.length > 0) {
            this.currentY += 10;
            this.addNutritionSuggestions(nutritionData.建议);
        }
        
        // 每日推荐摄入量参考
        this.currentY += 15;
        this.addNutritionReference();
    }
    
    // 添加购物清单
    async addShoppingList(shoppingList) {
        const { config, currentDoc, pageWidth } = this;
        this.currentY = config.margin.top;
        
        // 标题
        currentDoc.setFont(config.fonts.bold);
        currentDoc.setFontSize(24);
        currentDoc.setTextColor(...config.colors.primary);
        currentDoc.text('购物清单', pageWidth / 2, this.currentY, { align: 'center' });
        this.currentY += 15;
        
        // 统计信息
        currentDoc.setFont(config.fonts.normal);
        currentDoc.setFontSize(12);
        currentDoc.setTextColor(...config.colors.muted);
        
        const totalItems = shoppingList.统计?.总项数 || 0;
        currentDoc.text(`总项目数: ${totalItems}项`, 20, this.currentY);
        this.currentY += 8;
        
        this.addDivider();
        this.currentY += 5;
        
        // 按类别显示购物清单
        const categories = ['蔬菜类', '肉类', '水产类', '调味品', '主食类', '其他'];
        
        for (const category of categories) {
            const items = shoppingList.清单?.[category] || [];
            if (items.length === 0) continue;
            
            // 检查是否需要换页
            if (this.currentY > this.pageHeight - 50) {
                this.addNewPage();
                this.currentY = config.margin.top;
            }
            
            // 类别标题
            this.addCategoryTitle(category, items.length);
            
            // 物品列表
            for (const item of items) {
                if (this.currentY > this.pageHeight - 30) {
                    this.addNewPage();
                    this.currentY = config.margin.top;
                }
                
                this.addShoppingItem(item);
            }
            
            this.currentY += 5;
        }
        
        // 购物提示
        this.currentY += 10;
        this.addShoppingTips();
    }
    
    // 添加新页面
    addNewPage() {
        this.currentDoc.addPage();
        this.currentPage++;
        this.currentY = this.config.margin.top;
        this.addPageHeader();
    }
    
    // 添加页面页眉
    addPageHeader() {
        const { config, currentDoc, pageWidth, currentPage } = this;
        
        // 页面标题（仅在第二页及之后显示）
        if (currentPage > 1) {
            currentDoc.setFont(config.fonts.light);
            currentDoc.setFontSize(10);
            currentDoc.setTextColor(...config.colors.muted);
            currentDoc.text('食刻智能菜谱 - 推荐菜单', 20, 10);
            
            // 页码
            currentDoc.text(`第 ${currentPage} 页`, pageWidth - 20, 10, { align: 'right' });
            
            // 页眉分隔线
            currentDoc.setDrawColor(...config.colors.primary);
            currentDoc.setLineWidth(0.3);
            currentDoc.line(20, 13, pageWidth - 20, 13);
        }
    }
    
    // 添加页面页脚
    addPageFooter() {
        const { config, currentDoc, pageWidth, pageHeight, currentPage } = this;
        
        for (let i = 1; i <= currentPage; i++) {
            currentDoc.setPage(i);
            
            // 页脚信息
            currentDoc.setFont(config.fonts.light);
            currentDoc.setFontSize(9);
            currentDoc.setTextColor(...config.colors.muted);
            
            const footerY = pageHeight - 10;
            currentDoc.text('Generated by Smart Recipe System', pageWidth / 2, footerY, { align: 'center' });
            
            // 页脚分隔线
            currentDoc.setDrawColor(...config.colors.primary, 0.3);
            currentDoc.setLineWidth(0.2);
            currentDoc.line(20, footerY - 5, pageWidth - 20, footerY - 5);
        }
    }
    
    // 添加类别标题
    addCategoryTitle(title, count) {
        const { config, currentDoc } = this;
        
        currentDoc.setFont(config.fonts.bold);
        currentDoc.setFontSize(16);
        currentDoc.setTextColor(...config.colors.secondary);
        currentDoc.text(`${title} (${count}项)`, 20, this.currentY);
        this.currentY += 8;
        
        // 下划线
        currentDoc.setDrawColor(...config.colors.secondary);
        currentDoc.setLineWidth(0.5);
        currentDoc.line(20, this.currentY - 2, 60, this.currentY - 2);
        
        this.currentY += 5;
    }
    
    // 添加菜谱项
    addRecipeItem(recipe, category) {
        const { config, currentDoc, pageWidth } = this;
        
        // 菜谱名称
        currentDoc.setFont(config.fonts.bold);
        currentDoc.setFontSize(12);
        currentDoc.setTextColor(...config.colors.text);
        currentDoc.text(recipe.菜品名称, 25, this.currentY);
        
        // 烹饪时间
        const totalTime = (recipe.准备时间 || 0) + (recipe.烹饪时间 || 0);
        currentDoc.setFont(config.fonts.normal);
        currentDoc.setFontSize(10);
        currentDoc.setTextColor(...config.colors.muted);
        currentDoc.text(this.formatTime(totalTime), pageWidth - 30, this.currentY, { align: 'right' });
        
        // 标签（如果有）
        if (recipe.菜品标签 && recipe.菜品标签.length > 0) {
            this.currentY += 5;
            
            currentDoc.setFontSize(8);
            const tags = recipe.菜品标签.slice(0, 3); // 最多显示3个标签
            
            let tagX = 25;
            for (const tag of tags) {
                const tagWidth = currentDoc.getTextWidth(tag) + 4;
                
                if (tagX + tagWidth > pageWidth - 30) {
                    break;
                }
                
                // 标签背景
                currentDoc.setFillColor(...config.colors.accent, 0.1);
                currentDoc.roundedRect(tagX - 2, this.currentY - 3, tagWidth, 4, 1, 1, 'F');
                
                // 标签文字
                currentDoc.setTextColor(...config.colors.accent);
                currentDoc.text(tag, tagX, this.currentY);
                
                tagX += tagWidth + 4;
            }
        }
        
        this.currentY += 10;
    }
    
    // 添加食材清单
    addIngredientsList(ingredients, seasonings = []) {
        const { config, currentDoc } = this;
        
        // 主要食材标题
        currentDoc.setFont(config.fonts.bold);
        currentDoc.setFontSize(12);
        currentDoc.setTextColor(...config.colors.primary);
        currentDoc.text('主要食材', 20, this.currentY);
        this.currentY += 8;
        
        // 食材列表
        currentDoc.setFont(config.fonts.normal);
        currentDoc.setFontSize(11);
        currentDoc.setTextColor(...config.colors.text);
        
        for (const ingredient of ingredients) {
            const ingredientText = `• ${ingredient.食材名称}: ${ingredient.用量} ${ingredient.单位}`;
            currentDoc.text(ingredientText, 25, this.currentY);
            this.currentY += 6;
        }
        
        this.currentY += 5;
        
        // 调味料（如果有）
        if (seasonings.length > 0) {
            currentDoc.setFont(config.fonts.bold);
            currentDoc.setFontSize(12);
            currentDoc.setTextColor(...config.colors.primary);
            currentDoc.text('调味料', 20, this.currentY);
            this.currentY += 8;
            
            currentDoc.setFont(config.fonts.normal);
            currentDoc.setFontSize(11);
            
            for (const seasoning of seasonings) {
                const seasoningText = `• ${seasoning.名称}: ${seasoning.用量} ${seasoning.单位}`;
                currentDoc.text(seasoningText, 25, this.currentY);
                this.currentY += 6;
            }
        }
        
        this.currentY += 5;
    }
    
    // 添加烹饪步骤
    addCookingSteps(steps) {
        const { config, currentDoc, pageWidth } = this;
        
        currentDoc.setFont(config.fonts.bold);
        currentDoc.setFontSize(12);
        currentDoc.setTextColor(...config.colors.primary);
        currentDoc.text('烹饪步骤', 20, this.currentY);
        this.currentY += 8;
        
        currentDoc.setFont(config.fonts.normal);
        currentDoc.setFontSize(11);
        currentDoc.setTextColor(...config.colors.text);
        
        for (let i = 0; i < steps.length; i++) {
            const step = steps[i];
            const stepNumber = step.步骤序号 || i + 1;
            
            // 步骤编号和描述
            const stepText = `${stepNumber}. ${step.步骤描述}`;
            const stepLines = currentDoc.splitTextToSize(stepText, pageWidth - 45);
            
            // 步骤编号圆圈
            currentDoc.setFillColor(...config.colors.accent, 0.2);
            currentDoc.circle(25, this.currentY + 2, 3, 'F');
            
            currentDoc.setFont(config.fonts.bold);
            currentDoc.setFontSize(10);
            currentDoc.setTextColor(...config.colors.accent);
            currentDoc.text(stepNumber.toString(), 25, this.currentY + 3, { align: 'center' });
            
            // 步骤描述
            currentDoc.setFont(config.fonts.normal);
            currentDoc.setFontSize(11);
            currentDoc.setTextColor(...config.colors.text);
            currentDoc.text(stepLines, 35, this.currentY);
            
            this.currentY += stepLines.length * 5 + 3;
            
            // 烹饪技巧（如果有）
            if (step.烹饪技巧) {
                currentDoc.setFont(config.fonts.normal);
                currentDoc.setFontSize(10);
                currentDoc.setTextColor(...config.colors.muted);
                currentDoc.text(`💡 ${step.烹饪技巧}`, 40, this.currentY);
                this.currentY += 6;
            }
            
            // 预计时间（如果有）
            if (step.预计时间) {
                currentDoc.text(`⏱️ ${step.预计时间}分钟`, pageWidth - 30, this.currentY - 6, { align: 'right' });
            }
            
            this.currentY += 3;
        }
        
        this.currentY += 5;
    }
    
    // 添加烹饪提示
    addCookingTips(tips, title = '烹饪提示') {
        const { config, currentDoc } = this;
        
        currentDoc.setFont(config.fonts.bold);
        currentDoc.setFontSize(12);
        currentDoc.setTextColor(...config.colors.secondary);
        currentDoc.text(title, 20, this.currentY);
        this.currentY += 8;
        
        currentDoc.setFont(config.fonts.normal);
        currentDoc.setFontSize(11);
        currentDoc.setTextColor(...config.colors.text);
        
        for (const tip of tips) {
            const tipText = `• ${tip}`;
            currentDoc.text(tipText, 25, this.currentY);
            this.currentY += 6;
        }
        
        this.currentY += 5;
    }
    
    // 添加营养数据表格
    addNutritionTable(nutritionData) {
        const { config, currentDoc, pageWidth } = this;
        const tableX = 30;
        let tableY = this.currentY;
        
        // 表头
        currentDoc.setFont(config.fonts.bold);
        currentDoc.setFontSize(11);
        currentDoc.setTextColor(255, 255, 255);
        
        // 表头背景
        currentDoc.setFillColor(...config.colors.primary);
        currentDoc.rect(tableX - 5, tableY - 5, pageWidth - 60, 8, 'F');
        
        currentDoc.text('营养成分', tableX, tableY);
        currentDoc.text('含量', tableX + 80, tableY);
        currentDoc.text('百分比', tableX + 120, tableY);
        currentDoc.text('评价', tableX + 160, tableY);
        
        tableY += 8;
        
        // 表格数据
        const nutrients = [
            { label: '热量', value: nutritionData.总量?.热量, unit: '大卡', percent: nutritionData.百分比?.热量, evaluation: nutritionData.评价?.热量 },
            { label: '蛋白质', value: nutritionData.总量?.蛋白质, unit: '克', percent: nutritionData.百分比?.蛋白质, evaluation: nutritionData.评价?.蛋白质 },
            { label: '碳水化合物', value: nutritionData.总量?.碳水化合物, unit: '克', percent: nutritionData.百分比?.碳水化合物, evaluation: '适中' },
            { label: '脂肪', value: nutritionData.总量?.脂肪, unit: '克', percent: nutritionData.百分比?.脂肪, evaluation: nutritionData.评价?.脂肪 },
            { label: '纤维素', value: nutritionData.总量?.纤维素, unit: '克', percent: nutritionData.百分比?.纤维素, evaluation: '适中' }
        ];
        
        currentDoc.setFont(config.fonts.normal);
        currentDoc.setFontSize(10);
        
        let rowIndex = 0;
        for (const nutrient of nutrients) {
            if (!nutrient.value) continue;
            
            // 交替行背景色
            if (rowIndex % 2 === 0) {
                currentDoc.setFillColor(250, 250, 250);
                currentDoc.rect(tableX - 5, tableY - 3, pageWidth - 60, 6, 'F');
            }
            
            // 营养成分
            currentDoc.setTextColor(...config.colors.text);
            currentDoc.text(nutrient.label, tableX, tableY);
            
            // 含量
            currentDoc.text(`${nutrient.value} ${nutrient.unit}`, tableX + 80, tableY);
            
            // 百分比和进度条
            if (nutrient.percent) {
                currentDoc.text(`${nutrient.percent}%`, tableX + 120, tableY);
                
                // 进度条
                const progressWidth = 40;
                const progressPercent = Math.min(nutrient.percent, 100);
                
                // 进度条背景
                currentDoc.setFillColor(230, 230, 230);
                currentDoc.rect(tableX + 130, tableY - 2, progressWidth, 3, 'F');
                
                // 进度条前景
                const progressColor = this.getProgressColor(progressPercent);
                currentDoc.setFillColor(...progressColor);
                currentDoc.rect(tableX + 130, tableY - 2, progressWidth * (progressPercent / 100), 3, 'F');
            }
            
            // 评价
            if (nutrient.evaluation) {
                currentDoc.setTextColor(...this.getEvaluationColor(nutrient.evaluation));
                currentDoc.text(nutrient.evaluation, tableX + 160, tableY);
            }
            
            tableY += 7;
            rowIndex++;
        }
        
        this.currentY = tableY + 5;
    }
    
    // 添加营养建议
    addNutritionSuggestions(suggestions) {
        const { config, currentDoc } = this;
        
        currentDoc.setFont(config.fonts.bold);
        currentDoc.setFontSize(12);
        currentDoc.setTextColor(...config.colors.primary);
        currentDoc.text('饮食建议', 20, this.currentY);
        this.currentY += 8;
        
        currentDoc.setFont(config.fonts.normal);
        currentDoc.setFontSize(11);
        currentDoc.setTextColor(...config.colors.text);
        
        for (const suggestion of suggestions) {
            currentDoc.text(`• ${suggestion}`, 25, this.currentY);
            this.currentY += 6;
        }
    }
    
    // 添加营养参考
    addNutritionReference() {
        const { config, currentDoc, pageWidth } = this;
        
        currentDoc.setFont(config.fonts.light);
        currentDoc.setFontSize(9);
        currentDoc.setTextColor(...config.colors.muted);
        
        const referenceText = '* 营养数据基于成人每日推荐摄入量计算，仅供参考';
        currentDoc.text(referenceText, pageWidth / 2, this.currentY, { align: 'center' });
    }
    
    // 添加购物清单项
    addShoppingItem(item) {
        const { config, currentDoc } = this;
        
        // 复选框
        currentDoc.setDrawColor(...config.colors.muted);
        currentDoc.setLineWidth(0.3);
        currentDoc.rect(25, this.currentY - 2, 3, 3, 'S');
        
        // 物品名称
        currentDoc.setFont(config.fonts.normal);
        currentDoc.setFontSize(11);
        currentDoc.setTextColor(...config.colors.text);
        currentDoc.text(item.名称, 35, this.currentY);
        
        // 用量
        currentDoc.setFont(config.fonts.normal);
        currentDoc.setFontSize(10);
        currentDoc.setTextColor(...config.colors.primary);
        currentDoc.text(`${item.用量} ${item.单位}`, 120, this.currentY);
        
        this.currentY += 6;
    }
    
    // 添加购物提示
    addShoppingTips() {
        const { config, currentDoc } = this;
        
        currentDoc.setFont(config.fonts.bold);
        currentDoc.setFontSize(12);
        currentDoc.setTextColor(...config.colors.secondary);
        currentDoc.text('购物提示', 20, this.currentY);
        this.currentY += 8;
        
        const tips = [
            '✓ 建议按照分类购买，提高效率',
            '✓ 蔬菜类建议当天购买，保持新鲜',
            '✓ 肉类可提前购买冷冻保存',
            '✓ 检查家中的调味品是否充足',
            '✓ 购买时注意食材的新鲜度'
        ];
        
        currentDoc.setFont(config.fonts.normal);
        currentDoc.setFontSize(11);
        currentDoc.setTextColor(...config.colors.text);
        
        for (const tip of tips) {
            currentDoc.text(tip, 25, this.currentY);
            this.currentY += 6;
        }
    }
    
    // 添加分隔线
    addDivider() {
        const { config, currentDoc, pageWidth } = this;
        
        currentDoc.setDrawColor(...config.colors.primary, 0.2);
        currentDoc.setLineWidth(0.3);
        currentDoc.line(20, this.currentY, pageWidth - 20, this.currentY);
        this.currentY += 5;
    }
    
    // 添加字体到文档
    async addFontsToDoc() {
        const { config, currentDoc } = this;
        
        // 如果字体可用，添加到文档
        if (config.fonts.normal !== 'helvetica') {
            try {
                // 这里需要实际的字体文件
                // currentDoc.addFont('/fonts/notosanssc-normal.ttf', 'notosanssc', 'normal');
                // currentDoc.addFont('/fonts/notosanssc-bold.ttf', 'notosanssc-bold', 'bold');
                // currentDoc.addFont('/fonts/notosanssc-light.ttf', 'notosanssc-light', 'light');
                
                // 设置默认字体
                currentDoc.setFont('notosanssc');
            } catch (error) {
                console.warn('添加字体失败:', error);
                // 回退到默认字体
                config.fonts.normal = 'helvetica';
                config.fonts.bold = 'helvetica';
                config.fonts.light = 'helvetica';
            }
        }
    }
    
    // 工具函数
    formatDate(dateString) {
        const date = new Date(dateString || Date.now());
        return date.toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
    
    formatTime(minutes) {
        if (!minutes) return '0分钟';
        
        if (minutes < 60) {
            return `${minutes}分钟`;
        }
        
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        
        if (mins === 0) {
            return `${hours}小时`;
        } else {
            return `${hours}小时${mins}分钟`;
        }
    }
    
    calculateTotalTime(menu) {
        if (!menu) return 0;
        
        let total = 0;
        Object.values(menu).flat().forEach(recipe => {
            total += (recipe.准备时间 || 0) + (recipe.烹饪时间 || 0);
        });
        
        return total;
    }
    
    getFileName(options) {
        const date = new Date();
        const dateStr = date.toISOString().split('T')[0];
        const timeStr = date.toTimeString().split(' ')[0].replace(/:/g, '-');
        
        let fileName = `智能菜单_${dateStr}_${timeStr}`;
        
        if (options.customName) {
            fileName = options.customName;
        }
        
        return `${fileName}.pdf`;
    }
    
    getNutritionColor(evaluation) {
        switch (evaluation) {
            case '营养均衡':
            case '充足':
            case '适中':
                return this.config.colors.primary;
            case '偏低':
            case '营养不足':
                return [255, 152, 0]; // 橙色
            case '偏高':
            case '营养过剩':
                return [231, 76, 60]; // 红色
            default:
                return this.config.colors.text;
        }
    }
    
    getProgressColor(percent) {
        if (percent < 60) {
            return [255, 152, 0]; // 橙色
        } else if (percent < 90) {
            return this.config.colors.primary; // 绿色
        } else {
            return [231, 76, 60]; // 红色
        }
    }
    
    getEvaluationColor(evaluation) {
        switch (evaluation) {
            case '充足':
            case '适中':
                return this.config.colors.primary;
            case '偏低':
                return [255, 152, 0]; // 橙色
            case '偏高':
                return [231, 76, 60]; // 红色
            default:
                return this.config.colors.text;
        }
    }
}

// ============================================
// 导出函数（与现有代码兼容）
// ============================================

// 全局PDF导出器实例
let pdfExporter = null;

// 初始化PDF导出器
async function initPDFExporter() {
    if (!pdfExporter) {
        pdfExporter = new PDFExporter();
        // 等待初始化完成
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    return pdfExporter;
}

// 导出菜单到PDF（主函数）
async function exportToPDF(menuData, options = {}) {
    try {
        // 检查jsPDF是否可用
        if (typeof window.jspdf === 'undefined') {
            throw new Error('jsPDF库未加载，请确保已引入jsPDF');
        }
        
        // 初始化导出器
        const exporter = await initPDFExporter();
        
        // 默认选项
        const defaultOptions = {
            includeRecipes: true,
            includeNutrition: true,
            includeShoppingList: true,
            customName: null,
            ...options
        };
        
        // 显示导出提示
        showNotification('正在生成PDF', '请稍候...', 'info');
        
        // 执行导出
        const result = await exporter.exportMenu(menuData, defaultOptions);
        
        // 显示成功通知
        showNotification('导出成功', `PDF文件已保存: ${result.fileName}`, 'success', 3000);
        
        return result;
    } catch (error) {
        console.error('PDF导出失败:', error);
        showNotification('导出失败', error.message, 'error');
        throw error;
    }
}

// 显示通知函数（与主应用兼容）
function showNotification(title, message, type = 'info', duration = 3000) {
    // 使用主应用的通知系统，如果可用
    if (window.showNotification) {
        window.showNotification(title, message, type, duration);
    } else {
        // 简单的控制台通知
        console.log(`[${type.toUpperCase()}] ${title}: ${message}`);
        
        // 简单的浏览器通知
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(title, { body: message });
        }
    }
}

// 高级导出选项
function showExportOptions(menuData) {
    // 创建导出选项对话框
    const dialog = document.createElement('div');
    dialog.className = '导出选项对话框';
    dialog.innerHTML = `
        <div class="对话框内容">
            <h3><i class="fas fa-file-pdf"></i> PDF 导出选项</h3>
            
            <div class="选项组">
                <label class="选项项">
                    <input type="checkbox" id="includeRecipes" checked>
                    <span>包含菜谱详情</span>
                </label>
                
                <label class="选项项">
                    <input type="checkbox" id="includeNutrition" checked>
                    <span>包含营养分析</span>
                </label>
                
                <label class="选项项">
                    <input type="checkbox" id="includeShoppingList" checked>
                    <span>包含购物清单</span>
                </label>
                
                <label class="选项项">
                    <input type="checkbox" id="includeImages">
                    <span>包含菜品图片</span>
                    <small class="选项提示">（文件较大）</small>
                </label>
            </div>
            
            <div class="文件名组">
                <label for="fileName">文件名：</label>
                <input type="text" id="fileName" value="智能推荐菜单" placeholder="请输入文件名">
            </div>
            
            <div class="对话框操作">
                <button class="次要按钮" onclick="this.closest('.导出选项对话框').remove()">
                    取消
                </button>
                <button class="主要按钮" onclick="confirmExport(this.closest('.导出选项对话框'))">
                    <i class="fas fa-download"></i> 导出PDF
                </button>
            </div>
        </div>
    `;
    
    // 添加到页面
    document.body.appendChild(dialog);
    
    // 样式
    const style = document.createElement('style');
    style.textContent = `
        .导出选项对话框 {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
            backdrop-filter: blur(4px);
            animation: fadeIn 0.2s ease;
        }
        
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        
        .对话框内容 {
            background: white;
            border-radius: 16px;
            padding: 24px;
            width: 90%;
            max-width: 400px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        }
        
        .对话框内容 h3 {
            margin: 0 0 20px 0;
            color: #2C3E50;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        .选项组 {
            display: flex;
            flex-direction: column;
            gap: 12px;
            margin-bottom: 20px;
        }
        
        .选项项 {
            display: flex;
            align-items: center;
            gap: 10px;
            cursor: pointer;
            padding: 8px;
            border-radius: 8px;
            transition: background 0.2s;
        }
        
        .选项项:hover {
            background: #F8FFF8;
        }
        
        .选项项 input[type="checkbox"] {
            width: 18px;
            height: 18px;
            accent-color: #2E8B57;
        }
        
        .选项项 span {
            flex: 1;
            color: #2C3E50;
            font-weight: 500;
        }
        
        .选项提示 {
            color: #95A5A6;
            font-size: 12px;
        }
        
        .文件名组 {
            margin-bottom: 24px;
        }
        
        .文件名组 label {
            display: block;
            margin-bottom: 8px;
            color: #2C3E50;
            font-weight: 500;
        }
        
        .文件名组 input {
            width: 100%;
            padding: 10px 12px;
            border: 2px solid #E8F5E9;
            border-radius: 8px;
            font-size: 14px;
            transition: all 0.2s;
        }
        
        .文件名组 input:focus {
            outline: none;
            border-color: #2E8B57;
            box-shadow: 0 0 0 3px rgba(46, 139, 87, 0.1);
        }
        
        .对话框操作 {
            display: flex;
            gap: 12px;
        }
        
        .对话框操作 button {
            flex: 1;
            padding: 12px 20px;
            border-radius: 8px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
        }
        
        .次要按钮 {
            background: white;
            color: #2E8B57;
            border: 2px solid #E8F5E9;
        }
        
        .次要按钮:hover {
            background: #F8FFF8;
            border-color: #2E8B57;
        }
        
        .主要按钮 {
            background: #2E8B57;
            color: white;
            border: 2px solid #2E8B57;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
        }
        
        .主要按钮:hover {
            background: #1A6D3E;
            border-color: #1A6D3E;
            transform: translateY(-1px);
        }
    `;
    
    document.head.appendChild(style);
}

// 确认导出
async function confirmExport(dialog) {
    const includeRecipes = dialog.querySelector('#includeRecipes').checked;
    const includeNutrition = dialog.querySelector('#includeNutrition').checked;
    const includeShoppingList = dialog.querySelector('#includeShoppingList').checked;
    const includeImages = dialog.querySelector('#includeImages').checked;
    const fileName = dialog.querySelector('#fileName').value || '智能推荐菜单';
    
    // 获取当前菜单数据（假设全局变量中有）
    const menuData = window.currentMenu || getCurrentMenuData();
    
    if (!menuData) {
        showNotification('错误', '没有找到菜单数据', 'error');
        return;
    }
    
    // 移除对话框
    dialog.remove();
    
    // 执行导出
    try {
        await exportToPDF(menuData, {
            includeRecipes,
            includeNutrition,
            includeShoppingList,
            includeImages,
            customName: fileName
        });
    } catch (error) {
        showNotification('导出失败', error.message, 'error');
    }
}

// 简单的菜单导出按钮（与现有代码兼容）
function 导出PDF() {
    // 检查是否有当前菜单
    if (!window.currentMenu) {
        showNotification('提示', '请先生成菜单', 'warning');
        return;
    }
    
    // 显示导出选项
    showExportOptions(window.currentMenu);
}

// 导出函数到全局
window.导出PDF = 导出PDF;
window.exportToPDF = exportToPDF;
window.showExportOptions = showExportOptions;
window.confirmExport = confirmExport;

// 自动初始化
document.addEventListener('DOMContentLoaded', async () => {
    // 延迟初始化，避免影响页面加载
    setTimeout(async () => {
        try {
            await initPDFExporter();
            console.log('PDF导出模块已初始化');
        } catch (error) {
            console.warn('PDF导出模块初始化失败:', error);
        }
    }, 2000);
});

// 导出类供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        PDFExporter,
        exportToPDF,
        导出PDF
    };
}
