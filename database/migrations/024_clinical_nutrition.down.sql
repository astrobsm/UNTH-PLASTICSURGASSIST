-- 024 down. Non-destructive by design: measurements, assessments, intake and
-- meal plans are clinical records. Rolling back the code is enough. Drop only
-- after exporting the tables and with the clinical lead's agreement:
--   DROP TABLE nutrition_config_signoffs, nutrition_household_measures,
--     nutrition_recipe_ingredients, nutrition_recipes, nutrition_foods,
--     nutrition_food_sources, nutrition_intake, nutrition_meal_plans,
--     nutrition_assessments, nutrition_measurements;
SELECT 1;
