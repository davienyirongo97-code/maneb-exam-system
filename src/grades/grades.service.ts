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



async preLoadResultsFromDbToCache() {
  try {
    const BATCH_SIZE = 1000;
    let lastId = 0;
    let hasMore = true;

    while (hasMore) {
      const grades = await sql`
        SELECT *
        FROM grades
        WHERE id > ${lastId}
        ORDER BY id
        LIMIT ${BATCH_SIZE}
      `;

      if (grades.length === 0) {
        hasMore = false;
        break;
      }

      await Promise.all(
        grades.map((grade) => {
          const normalizedDob =
            grade.date_of_birth instanceof Date
              ? grade.date_of_birth.toISOString().split('T')[0]
              : String(grade.date_of_birth).split('T')[0];

          const cacheKey = `student:${grade.student_number}:${normalizedDob}`;


          const preparedGrade: StudentMarksDto = {
            first_name: grade.first_name,
            middle_name: grade.middle_name,
            last_name: grade.last_name,
            date_of_birth: grade.date_of_birth,
            student_number: grade.student_number,
            exam_center: grade.exam_center,
            accounting: grade.accounting,
            agriculture: grade.agriculture,
            bible_knowledge: grade.bible_knowledge,
            biology: grade.biology,
            business_studies: grade.business_studies,
            chemistry: grade.chemistry,
            chichewa: grade.chichewa,
            computer_studies: grade.computer_studies,
            english: grade.english,
            geography: grade.geography,
            history: grade.history,
            home_economics: grade.home_economics,
            mathematics: grade.mathematics,
            physics: grade.physics,
            social_studies: grade.social_studies,
            technical_drawing: grade.technical_drawing,
          };

          return this.redis.set(cacheKey, preparedGrade, 86400);
        })
      );

      // move cursor forward
      lastId = grades[grades.length - 1].id;
    }

  } catch (error) {
    console.error(error);
  }
}

  // clear Redis cache after a new upload
  async clearCache(student_number: string, date_of_birth: string) {
    const key = `student:${student_number}:${date_of_birth}`;
    await this.redis.del(key);
  }

}



type ErrorEntry = {
  row: number;
  missing?: string[];
  invalidMarks?: string[];
  error?: string;
};

