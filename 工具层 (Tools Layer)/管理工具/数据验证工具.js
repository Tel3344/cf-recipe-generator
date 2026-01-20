// 数据验证架构
class RecipeValidator {
  static SCHEMA = {
    菜品名称: { type: 'string', required: true, maxLength: 50 },
    菜品分类: { type: 'array', required: true, items: { type: 'string' } },
    适用季节: { type: 'array', required: true },
    准备时间: { type: 'number', min: 1, max: 300 },
    烹饪时间: { type: 'number', min: 1, max: 480 },
    标准份量: {
      type: 'object',
      required: true,
      properties: {
        基准人数: { type: 'number', min: 1, max: 20 },
        食材列表: { type: 'array', minItems: 1 }
      }
    }
  };
  
  static validate(recipe) {
    const errors = [];
    
    // 结构验证
    if (!recipe.菜品名称) {
      errors.push('菜品名称不能为空');
    }
    
    // 分类验证
    if (!Array.isArray(recipe.菜品分类) || recipe.菜品分类.length === 0) {
      errors.push('菜品分类不能为空');
    }
    
    // 时间验证
    if (recipe.准备时间 < 1 || recipe.准备时间 > 300) {
      errors.push('准备时间应在1-300分钟之间');
    }
    
    // 份量验证
    if (!recipe.标准份量 || !recipe.标准份量.基准人数) {
      errors.push('必须指定基准人数');
    }
    
    return {
      有效: errors.length === 0,
      错误信息: errors,
      建议: this.generateSuggestions(recipe)
    };
  }
  
  static async validateFile(file) {
    // 验证JSON文件
    try {
      const content = await file.text();
      const recipe = JSON.parse(content);
      return this.validate(recipe);
    } catch (error) {
      return {
        有效: false,
        错误信息: ['JSON解析错误: ' + error.message]
      };
    }
  }
}
