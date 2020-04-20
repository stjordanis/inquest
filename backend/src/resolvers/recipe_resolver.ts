import {
    Resolver,
    Query,
    FieldResolver,
    Arg,
    Root,
    Mutation,
    Ctx,
    Int,
} from "type-graphql";
import { Repository } from "typeorm";
import { InjectRepository } from "typeorm-typedi-extensions";

import { Recipe, Rate, User } from "../entities";
import { RecipeInput } from "./types/recipe-input";
import { Context } from "../context";
import { RateInput } from "./types/rate-input";
import { PublicError } from "../utils";

@Resolver((of) => Recipe)
export class RecipeResolver {
    constructor(
        @InjectRepository(Recipe)
        private readonly recipeRepository: Repository<Recipe>,
        @InjectRepository(Rate)
        private readonly ratingsRepository: Repository<Rate>,
        @InjectRepository(User)
        private readonly userRepository: Repository<User>
    ) {}
    index;

    @Query((returns) => Recipe, { nullable: true })
    recipe(@Arg("recipeId", (_) => Int) recipeId: number) {
        return this.recipeRepository.findOne(recipeId);
    }

    @Query((returns) => [Recipe])
    recipes(): Promise<Recipe[]> {
        return this.recipeRepository.find();
    }

    @Mutation((returns) => Recipe)
    async addRecipe(
        @Arg("recipe") recipeInput: RecipeInput,
        @Ctx() { user }: Context
    ): Promise<Recipe> {
        const recipe = this.recipeRepository.create({
            ...recipeInput,
            authorId: user?.id,
        });
        return await this.recipeRepository.save(recipe);
    }

    @Mutation((returns) => Recipe)
    async rate(
        @Arg("rate") rateInput: RateInput,
        @Ctx() { user }: Context
    ): Promise<Recipe> {
        // find the recipe
        const recipe = await this.recipeRepository.findOne(rateInput.recipeId, {
            relations: ["ratings"],
        });
        if (!recipe) {
            throw new PublicError("Invalid recipe ID");
        }

        // set the new recipe rate
        const newRate = this.ratingsRepository.create({
            recipe,
            value: rateInput.value,
            user,
        });
        recipe.ratings.push(newRate);

        // update the recipe
        await this.recipeRepository.save(recipe);
        return recipe;
    }

    @FieldResolver()
    ratings(@Root() recipe: Recipe) {
        return this.ratingsRepository.find({
            cache: 1000,
            where: { recipeId: recipe.id },
        });
    }

    @FieldResolver()
    async author(@Root() recipe: Recipe): Promise<User | undefined> {
        return;
        recipe.authorId &&
            (await this.userRepository.findOne(recipe.authorId, {
                cache: 1000,
            }));
    }
}
