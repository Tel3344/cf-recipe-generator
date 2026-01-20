// 智能菜谱推荐算法 - Cloudflare Worker
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    
    try {
      // CORS 头
      const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json; charset=utf-8'
      };
      
      // 处理预检请求
      if (request.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
      }
      
      // 路由分发
      switch (path) {
        case '/api/recommend':
          return await handleRecommend(request, env, corsHeaders);
        case '/api/recipes':
          return await handleRecipes(request, env, corsHeaders);
        case '/api/categories':
          return await handleCategories(request, env, corsHeaders);
        case '/api/upload':
          return await handleUpload(request, env, corsHeaders);
        default:
          return new Response(JSON.stringify({ 
            error: '未找到该路径',
            available: ['/api/recommend', '/api/recipes', '/api/categories', '/api/upload']
          }), { 
            status: 404, 
            headers: corsHeaders 
          });
      }
    } catch (error) {
      console.error('处理请求时出错:', error);
      return new Response(JSON.stringify({ 
        error: '服务器内部错误',
        message: error.message 
      }), { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' } 
      });
    }
  }
};

// 推荐菜单处理
async function handleRecommend(request, env, corsHeaders) {
  const url = new URL(request.url);
  const params = {
    用餐人数: parseInt(url.searchParams.get('人数')) || 6,
    季节: url.searchParams.get('季节') || getCurrentSeason(),
    口味偏好: url.searchParams.get('口味') ? url.searchParams.get('口味').split(',') : [],
    特殊需求: url.searchParams.get('需求') ? url.searchParams.get('需求').split(',') : [],
    烹饪时间: parseInt(url.searchParams.get('时间')) || 120,
    难度等级: url.searchParams.get('难度') || '不限'
  };
  
  // 验证参数
  if (params.用餐人数 < 1 || params.用餐人数 > 20) {
    return new Response(JSON.stringify({ 
      error: '用餐人数应在1-20人之间' 
    }), { 
      status: 400, 
      headers: corsHeaders 
    });
  }
  
  // 从缓存获取数据
  const cacheKey = `recommend:${JSON.stringify(params)}`;
  const cached = await env.RECIPE_CACHE.get(cacheKey);
  
  if (cached) {
    return new Response(cached, { headers: corsHeaders });
  }
  
  // 从GitHub获取菜谱数据
  const recipes = await fetchRecipesFromGitHub(env);
  
  // 智能推荐
  const 推荐引擎 = new RecommendationEngine();
  const menu = await 推荐引擎.recommend(recipes, params);
  
  // 计算营养信息
  const 营养分析器 = new NutritionCalculator();
  const 营养信息 = 营养分析器.calculate(menu, params.用餐人数);
  
  // 生成购物清单
  const 购物清单生成器 = new ShoppingListGenerator();
  const 购物清单 = 购物清单生成器.generate(menu, params.用餐人数);
  
  const responseData = {
    成功: true,
    参数: params,
    菜单: menu,
    营养信息: 营养信息,
    购物清单: 购物清单,
    生成时间: new Date().toISOString(),
    提示: getCookingTips(menu, params)
  };
  
  const responseJson = JSON.stringify(responseData, null, 2);
  
  // 缓存结果（5分钟）
  ctx.waitUntil(env.RECIPE_CACHE.put(cacheKey, responseJson, { 
    expirationTtl: 300 
  }));
  
  return new Response(responseJson, { headers: corsHeaders });
}

// 获取当前季节
function getCurrentSeason() {
  const month = new Date().getMonth() + 1;
  if (month >= 3 && month <= 5) return '春季';
  if (month >= 6 && month <= 8) return '夏季';
  if (month >= 9 && month <= 11) return '秋季';
  return '冬季';
}

// 从GitHub获取菜谱数据
async function fetchRecipesFromGitHub(env) {
  try {
    const repo = env.GITHUB_REPO || 'your-username/smart-recipe-system';
    const token = env.GITHUB_TOKEN;
    
    // 获取索引文件
    const indexUrl = `https://api.github.com/repos/${repo}/contents/分类索引/菜品分类.json`;
    const indexResponse = await fetch(indexUrl, {
      headers: {
        'Authorization': `token ${token}`,
        'User-Agent': 'Smart-Recipe-System'
      }
    });
    
    if (!indexResponse.ok) {
      throw new Error(`获取索引失败: ${indexResponse.status}`);
    }
    
    const indexData = await indexResponse.json();
    const indexContent = JSON.parse(atob(indexData.content));
    
    // 获取所有菜谱（简化版本，实际应该遍历目录）
    // 这里可以从缓存或预先构建的索引中获取
    const recipes = [];
    
    // 模拟数据 - 实际应该从GitHub读取
    const sampleRecipes = [
      {
        菜品标识: "SPRING001",
        菜品名称: "春笋炒肉片",
        菜品分类: ["主菜", "时令菜"],
        适用季节: ["春季"],
        难度等级: "初级",
        准备时间: 15,
        烹饪时间: 10,
        标准份量: {
          基准人数: 6,
          食材列表: [
            { 食材名称: "春笋", 用量: 500, 单位: "克" },
            { 食材名称: "猪里脊肉", 用量: 300, 单位: "克" }
          ]
        }
      },
      {
        菜品标识: "SUMMER001",
        菜品名称: "凉拌黄瓜",
        菜品分类: ["配菜", "凉菜"],
        适用季节: ["夏季"],
        难度等级: "初级",
        准备时间: 10,
        烹饪时间: 0
      }
    ];
    
    return sampleRecipes;
  } catch (error) {
    console.error('获取菜谱数据失败:', error);
    return [];
  }
}

// 菜谱查询处理
async function handleRecipes(request, env, corsHeaders) {
  const url = new URL(request.url);
  const 分类 = url.searchParams.get('分类');
  const 季节 = url.searchParams.get('季节');
  const 关键词 = url.searchParams.get('关键词');
  const 页码 = parseInt(url.searchParams.get('页码')) || 1;
  const 每页数量 = parseInt(url.searchParams.get('每页数量')) || 20;
  
  // 从GitHub获取菜谱数据
  const recipes = await fetchRecipesFromGitHub(env);
  
  // 过滤菜谱
  let filteredRecipes = recipes;
  
  if (分类) {
    filteredRecipes = filteredRecipes.filter(recipe => 
      recipe.菜品分类 && recipe.菜品分类.includes(分类)
    );
  }
  
  if (季节) {
    filteredRecipes = filteredRecipes.filter(recipe => 
      recipe.适用季节 && recipe.适用季节.includes(季节)
    );
  }
  
  if (关键词) {
    filteredRecipes = filteredRecipes.filter(recipe => 
      recipe.菜品名称 && recipe.菜品名称.includes(关键词) ||
      recipe.菜品描述 && recipe.菜品描述.includes(关键词)
    );
  }
  
  // 分页
  const 总数量 = filteredRecipes.length;
  const 总页数 = Math.ceil(总数量 / 每页数量);
  const 开始索引 = (页码 - 1) * 每页数量;
  const 结束索引 = 开始索引 + 每页数量;
  const 分页结果 = filteredRecipes.slice(开始索引, 结束索引);
  
  return new Response(JSON.stringify({
    成功: true,
    数据: 分页结果,
    分页: {
      页码: 页码,
      每页数量: 每页数量,
      总数量: 总数量,
      总页数: 总页数
    }
  }, null, 2), { headers: corsHeaders });
}

// 分类查询处理
async function handleCategories(request, env, corsHeaders) {
  try {
    const repo = env.GITHUB_REPO || 'your-username/smart-recipe-system';
    const token = env.GITHUB_TOKEN;
    
    // 获取分类数据
    const categories = await Promise.all([
      fetchFromGitHub(`${repo}/contents/分类索引/菜品分类.json`, token),
      fetchFromGitHub(`${repo}/contents/分类索引/时令数据.json`, token),
      fetchFromGitHub(`${repo}/contents/分类索引/食材索引.json`, token)
    ]);
    
    return new Response(JSON.stringify({
      成功: true,
      数据: {
        菜品分类: categories[0],
        时令数据: categories[1],
        食材索引: categories[2]
      }
    }, null, 2), { headers: corsHeaders });
  } catch (error) {
    return new Response(JSON.stringify({
      成功: false,
      错误: error.message
    }), { 
      status: 500, 
      headers: corsHeaders 
    });
  }
}

// 菜谱上传处理
async function handleUpload(request, env, corsHeaders) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ 
      error: '只支持POST请求' 
    }), { 
      status: 405, 
      headers: corsHeaders 
    });
  }
  
  try {
    const 数据 = await request.json();
    
    // 验证菜谱数据
    const 验证结果 = validateRecipe(数据);
    if (!验证结果.有效) {
      return new Response(JSON.stringify({
        成功: false,
        错误: '菜谱数据验证失败',
        详情: 验证结果.错误信息
      }), { 
        status: 400, 
        headers: corsHeaders 
      });
    }
    
    // 生成唯一ID
    const 时间戳 = Date.now();
    const 随机数 = Math.floor(Math.random() * 1000);
    const 菜品标识 = `USER${时间戳}${随机数}`;
    
    // 完善菜谱数据
    const 完整菜谱 = {
      ...数据,
      元数据: {
        菜品标识: 菜品标识,
        创建时间: new Date().toISOString(),
        更新时间: new Date().toISOString(),
        版本: '1.0',
        作者: '用户上传',
        状态: 'pending'
      }
    };
    
    // 这里应该将菜谱保存到GitHub
    // 由于GitHub API需要认证，这里简化处理
    console.log('收到菜谱上传:', 完整菜谱);
    
    return new Response(JSON.stringify({
      成功: true,
      消息: '菜谱上传成功，等待审核',
      菜品标识: 菜品标识,
      预览: {
        名称: 完整菜谱.菜品名称,
        分类: 完整菜谱.菜品分类
      }
    }, null, 2), { headers: corsHeaders });
  } catch (error) {
    return new Response(JSON.stringify({
      成功: false,
      错误: '处理上传时出错',
      详情: error.message
    }), { 
      status: 500, 
      headers: corsHeaders 
    });
  }
}

// 从GitHub获取JSON数据
async function fetchFromGitHub(path, token) {
  const response = await fetch(`https://api.github.com/repos/${path}`, {
    headers: {
      'Authorization': `token ${token}`,
      'User-Agent': 'Smart-Recipe-System',
      'Accept': 'application/vnd.github.v3+json'
    }
  });
  
  if (!response.ok) {
    throw new Error(`GitHub请求失败: ${response.status}`);
  }
  
  const data = await response.json();
  return JSON.parse(atob(data.content));
}

// 验证菜谱数据
function validateRecipe(recipe) {
  const errors = [];
  
  // 检查必填字段
  if (!recipe.菜品名称 || recipe.菜品名称.trim() === '') {
    errors.push('菜品名称不能为空');
  }
  
  if (!recipe.菜品分类 || !Array.isArray(recipe.菜品分类) || recipe.菜品分类.length === 0) {
    errors.push('菜品分类不能为空');
  }
  
  if (!recipe.适用季节 || !Array.isArray(recipe.适用季节) || recipe.适用季节.length === 0) {
    errors.push('适用季节不能为空');
  }
  
  // 检查时间
  if (recipe.准备时间 && (recipe.准备时间 < 0 || recipe.准备时间 > 300)) {
    errors.push('准备时间应在0-300分钟之间');
  }
  
  if (recipe.烹饪时间 && (recipe.烹饪时间 < 0 || recipe.烹饪时间 > 480)) {
    errors.push('烹饪时间应在0-480分钟之间');
  }
  
  // 检查份量信息
  if (recipe.标准份量) {
    if (!recipe.标准份量.基准人数 || recipe.标准份量.基准人数 < 1) {
      errors.push('基准人数应大于0');
    }
    
    if (recipe.标准份量.食材列表 && !Array.isArray(recipe.标准份量.食材列表)) {
      errors.push('食材列表格式错误');
    }
  }
  
  return {
    有效: errors.length === 0,
    错误信息: errors
  };
}

// 获取烹饪提示
function getCookingTips(menu, params) {
  const tips = [];
  
  // 根据季节的提示
  switch (params.季节) {
    case '春季':
      tips.push('春季食材鲜嫩，建议减少烹饪时间以保留原味');
      break;
    case '夏季':
      tips.push('夏季炎热，建议多采用凉拌、清蒸等清爽做法');
      break;
    case '秋季':
      tips.push('秋季干燥，建议多补充水分，适当增加汤品');
      break;
    case '冬季':
      tips.push('冬季寒冷，建议增加温热滋补的菜品');
      break;
  }
  
  // 根据人数的提示
  if (params.用餐人数 >= 8) {
    tips.push('用餐人数较多，建议提前准备，合理安排烹饪顺序');
  }
  
  // 根据时间的提示
  const 总时间 = Object.values(menu).flat().reduce((total, recipe) => 
    total + (recipe.准备时间 || 0) + (recipe.烹饪时间 || 0), 0);
  
  if (总时间 > 120) {
    tips.push('总烹饪时间较长，建议提前规划，可分阶段准备');
  }
  
  return tips;
}

// 推荐引擎类
class RecommendationEngine {
  async recommend(recipes, params) {
    // 过滤符合条件的菜谱
    let filteredRecipes = this.filterRecipes(recipes, params);
    
    // 如果没有足够菜谱，放宽条件
    if (filteredRecipes.length < 10) {
      filteredRecipes = this.filterRecipes(recipes, { ...params, 难度等级: '不限' });
    }
    
    // 按类别分组
    const categories = {
      主菜: filteredRecipes.filter(r => r.菜品分类 && r.菜品分类.includes('主菜')),
      配菜: filteredRecipes.filter(r => r.菜品分类 && r.菜品分类.includes('配菜')),
      汤品: filteredRecipes.filter(r => r.菜品分类 && r.菜品分类.includes('汤品')),
      主食: filteredRecipes.filter(r => r.菜品分类 && r.菜品分类.includes('主食'))
    };
    
    // 智能选择菜谱
    const selected = {
      主菜: this.selectMainDishes(categories.主菜, params),
      配菜: this.selectSideDishes(categories.配菜, params),
      汤品: this.selectSoups(categories.汤品, params),
      主食: this.selectStaples(categories.主食, params)
    };
    
    // 调整份量
    return this.adjustServings(selected, params.用餐人数);
  }
  
  filterRecipes(recipes, params) {
    return recipes.filter(recipe => {
      // 季节过滤
      if (params.季节 !== '不限' && recipe.适用季节 && !recipe.适用季节.includes(params.季节)) {
        return false;
      }
      
      // 难度过滤
      if (params.难度等级 !== '不限' && recipe.难度等级 && recipe.难度等级 !== params.难度等级) {
        return false;
      }
      
      // 时间过滤（如果设置了最大烹饪时间）
      if (params.烹饪时间 && recipe.烹饪时间 && recipe.烹饪时间 > params.烹饪时间) {
        return false;
      }
      
      // 特殊需求过滤
      if (params.特殊需求 && params.特殊需求.length > 0) {
        // 这里需要根据菜谱标签进行过滤
        // 简化处理，暂时通过
      }
      
      return true;
    });
  }
  
  selectMainDishes(recipes, params) {
    if (recipes.length === 0) return [];
    
    // 随机选择1-2道主菜
    const count = params.用餐人数 >= 8 ? 2 : 1;
    return this.randomSelect(recipes, count);
  }
  
  selectSideDishes(recipes, params) {
    if (recipes.length === 0) return [];
    
    // 根据人数选择配菜数量
    let count;
    if (params.用餐人数 <= 4) count = 1;
    else if (params.用餐人数 <= 8) count = 2;
    else count = 3;
    
    return this.randomSelect(recipes, count);
  }
  
  selectSoups(recipes, params) {
    if (recipes.length === 0) return [];
    return this.randomSelect(recipes, 1);
  }
  
  selectStaples(recipes, params) {
    if (recipes.length === 0) return [];
    return this.randomSelect(recipes, 1);
  }
  
  randomSelect(recipes, count) {
    const shuffled = [...recipes].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, Math.min(count, shuffled.length));
  }
  
  adjustServings(menu, people) {
    const adjustedMenu = {};
    
    for (const [category, recipes] of Object.entries(menu)) {
      adjustedMenu[category] = recipes.map(recipe => {
        if (!recipe.标准份量) return recipe;
        
        const ratio = people / recipe.标准份量.基准人数;
        const adjusted = JSON.parse(JSON.stringify(recipe));
        
        if (adjusted.标准份量 && adjusted.标准份量.食材列表) {
          adjusted.调整后食材 = adjusted.标准份量.食材列表.map(ingredient => ({
            ...ingredient,
            调整用量: Math.round(ingredient.用量 * ratio * 10) / 10
          }));
        }
        
        return adjusted;
      });
    }
    
    return adjustedMenu;
  }
}

// 营养计算器类
class NutritionCalculator {
  calculate(menu, people) {
    let total = {
      热量: 0,
      蛋白质: 0,
      碳水化合物: 0,
      脂肪: 0,
      纤维素: 0
    };
    
    // 汇总所有菜谱的营养信息
    Object.values(menu).flat().forEach(recipe => {
      if (recipe.营养成分) {
        const ratio = recipe.标准份量 ? people / recipe.标准份量.基准人数 : 1;
        
        total.热量 += (recipe.营养成分.热量 || 0) * ratio;
        total.蛋白质 += (recipe.营养成分.蛋白质 || 0) * ratio;
        total.碳水化合物 += (recipe.营养成分.碳水化合物 || 0) * ratio;
        total.脂肪 += (recipe.营养成分.脂肪 || 0) * ratio;
        total.纤维素 += (recipe.营养成分.纤维素 || 0) * ratio;
      }
    });
    
    // 计算百分比（以成人每日推荐摄入量为基准）
    const dailyRecommendation = {
      热量: 2000,
      蛋白质: 60,
      碳水化合物: 300,
      脂肪: 67,
      纤维素: 25
    };
    
    const percentages = {};
    for (const [key, value] of Object.entries(total)) {
      percentages[key] = Math.round((value / dailyRecommendation[key]) * 100);
    }
    
    // 评估营养均衡性
    const evaluation = this.evaluateNutrition(total, dailyRecommendation);
    
    return {
      总量: total,
      百分比: percentages,
      评价: evaluation,
      建议: this.getNutritionSuggestions(evaluation)
    };
  }
  
  evaluateNutrition(total, recommendation) {
    const scores = {};
    
    // 热量评估
    const calorieRatio = total.热量 / recommendation.热量;
    if (calorieRatio < 0.7) scores.热量 = '偏低';
    else if (calorieRatio > 1.3) scores.热量 = '偏高';
    else scores.热量 = '适中';
    
    // 蛋白质评估
    const proteinRatio = total.蛋白质 / recommendation.蛋白质;
    if (proteinRatio < 0.8) scores.蛋白质 = '偏低';
    else if (proteinRatio > 1.2) scores.蛋白质 = '偏高';
    else scores.蛋白质 = '充足';
    
    // 脂肪评估
    const fatRatio = total.脂肪 / recommendation.脂肪;
    if (fatRatio < 0.7) scores.脂肪 = '偏低';
    else if (fatRatio > 1.3) scores.脂肪 = '偏高';
    else scores.脂肪 = '适中';
    
    // 总体评价
    const lowCount = Object.values(scores).filter(s => s === '偏低').length;
    const highCount = Object.values(scores).filter(s => s === '偏高').length;
    
    if (lowCount > 2) scores.总体 = '营养不足';
    else if (highCount > 2) scores.总体 = '营养过剩';
    else if (scores.蛋白质 === '充足' && scores.脂肪 === '适中') scores.总体 = '营养均衡';
    else scores.总体 = '基本均衡';
    
    return scores;
  }
  
  getNutritionSuggestions(evaluation) {
    const suggestions = [];
    
    if (evaluation.热量 === '偏低') {
      suggestions.push('建议增加主食或蛋白质摄入');
    } else if (evaluation.热量 === '偏高') {
      suggestions.push('建议减少油脂或主食摄入');
    }
    
    if (evaluation.蛋白质 === '偏低') {
      suggestions.push('建议增加肉类、豆制品或蛋奶摄入');
    }
    
    if (evaluation.脂肪 === '偏高') {
      suggestions.push('建议减少油炸或高脂肪食材');
    }
    
    if (suggestions.length === 0) {
      suggestions.push('当前菜单营养均衡，继续保持');
    }
    
    return suggestions;
  }
}

// 购物清单生成器类
class ShoppingListGenerator {
  generate(menu, people) {
    const items = {};
    const categories = {
      蔬菜类: [],
      肉类: [],
      水产类: [],
      调味品: [],
      主食类: [],
      其他: []
    };
    
    // 合并所有菜谱的食材
    Object.values(menu).flat().forEach(recipe => {
      if (recipe.调整后食材) {
        recipe.调整后食材.forEach(ingredient => {
          const key = ingredient.食材名称;
          const unit = ingredient.单位 || '适量';
          
          if (!items[key]) {
            items[key] = {
              用量: 0,
              单位: unit,
              分类: this.categorizeIngredient(ingredient.食材名称)
            };
          }
          
          items[key].用量 += ingredient.调整用量;
        });
      }
    });
    
    // 按分类分组
    for (const [name, item] of Object.entries(items)) {
      const category = item.分类;
      if (categories[category]) {
        categories[category].push({
          名称: name,
          用量: Math.round(item.用量 * 100) / 100,
          单位: item.单位,
          已购买: false
        });
      }
    }
    
    // 排序和整理
    for (const category in categories) {
      categories[category].sort((a, b) => a.名称.localeCompare(b.名称, 'zh-CN'));
    }
    
    // 计算总量统计
    const stats = {
      总项数: Object.keys(items).length,
      分类统计: {}
    };
    
    for (const [category, items] of Object.entries(categories)) {
      if (items.length > 0) {
        stats.分类统计[category] = items.length;
      }
    }
    
    return {
      清单: categories,
      统计: stats,
      生成时间: new Date().toISOString(),
      用餐人数: people,
      提示: this.getShoppingTips(categories)
    };
  }
  
  categorizeIngredient(name) {
    // 根据食材名称判断分类
    const categories = {
      蔬菜类: ['菜', '笋', '菇', '菌', '椒', '瓜', '茄', '豆', '萝卜', '胡萝卜', '土豆', '红薯'],
      肉类: ['肉', '排', '腿', '蹄', '肝', '肚', '肠'],
      水产类: ['鱼', '虾', '蟹', '贝', '蛤', '蛏', '蚝', '参'],
      调味品: ['油', '盐', '酱', '醋', '糖', '料酒', '生抽', '老抽', '蚝油', '香油'],
      主食类: ['米', '面', '粉', '饭', '粥', '馒头', '包子', '饺子']
    };
    
    for (const [category, keywords] of Object.entries(categories)) {
      for (const keyword of keywords) {
        if (name.includes(keyword)) {
          return category;
        }
      }
    }
    
    return '其他';
  }
  
  getShoppingTips(categories) {
    const tips = [];
    
    if (categories.蔬菜类 && categories.蔬菜类.length > 5) {
      tips.push('蔬菜建议新鲜购买，当天使用');
    }
    
    if (categories.肉类 && categories.肉类.length > 0) {
      tips.push('肉类建议冷冻保存，使用前解冻');
    }
    
    if (categories.水产类 && categories.水产类.length > 0) {
      tips.push('水产建议当天购买，保持新鲜');
    }
    
    if (Object.keys(categories).some(cat => categories[cat] && categories[cat].length > 0)) {
      tips.push('建议按照清单分类购买，提高效率');
    }
    
    return tips.length > 0 ? tips : ['根据清单购买即可'];
  }
}
