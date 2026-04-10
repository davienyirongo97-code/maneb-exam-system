import { Injectable, BadRequestException, InternalServerErrorException, Inject, ConflictException } from '@nestjs/common';
import { sql } from '../db/db';
import { StudentMarksDto } from './dto/studentsMarks.dto';
import { gradeReultsRequest } from './dto/gradeReultsRequest.dto';
import type { Cache } from 'cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class GradesService {
  constructor(private readonly redis: RedisService) { }

  async viewCachedResults(data: gradeReultsRequest): Promise<StudentMarksDto> {
    const { date_of_birth, student_number } = data;


    const cacheKey = `student:${student_number}:${date_of_birth}`;

    try {

      const val = await this.redis.get('debug_key');
      const cached = await this.redis.get<StudentMarksDto>(cacheKey);

      if (cached) {
        return cached;
      }
      const results = await sql`
      SELECT * FROM grades
      WHERE date_of_birth = ${date_of_birth} 
        AND student_number = ${student_number}
      LIMIT 1;
    `;

      if (!results || results.length === 0) {
        throw new BadRequestException(
          'No results found for the provided student number and date of birth',
        );
      }

      const result = results[0];
      const response: StudentMarksDto = {
        first_name: result.first_name,
        middle_name: result.middle_name,
        last_name: result.last_name,
        date_of_birth: result.date_of_birth,
        student_number: result.student_number,
        exam_center: result.exam_center,
        accounting: result.accounting,
        agriculture: result.agriculture,
        bible_knowledge: result.bible_knowledge,
        biology: result.biology,
        business_studies: result.business_studies,
        chemistry: result.chemistry,
        chichewa: result.chichewa,
        computer_studies: result.computer_studies,
        english: result.english,
        geography: result.geography,
        history: result.history,
        home_economics: result.home_economics,
        mathematics: result.mathematics,
        physics: result.physics,
        social_studies: result.social_studies,
        technical_drawing: result.technical_drawing,
      };

      await this.redis.set(cacheKey, response, 60);

      return response;
    } catch (error) {

      if (error instanceof BadRequestException) throw error;

      throw new InternalServerErrorException(
        'Failed to retrieve student results',
      );
    }
  }

}



type ErrorEntry = {
  row: number;
  missing?: string[];
  invalidMarks?: string[];
  error?: string;
};

